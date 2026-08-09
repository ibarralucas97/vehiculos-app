const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validateMaintenancePayload } = require("../utils/validation");
const { buildNotificationPayload, sendPushToUser } = require("../utils/pushNotifications");
const { buildNotificationIntentUrl } = require("../utils/pushReminders");
const { logActivity } = require("../utils/activityLog");
const { recalculatePlan } = require("../utils/maintenancePlans");
const MAX_IMAGE_BASE64_LENGTH = 7_000_000;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);
function parseMaintenancePlanId(value){if(value===null||value===undefined||value==="")return null;const id=Number(value);return Number.isInteger(id)&&id>0?id:NaN;}

function parseMaintenanceImagePayload(payload = {}) {
  const imageUrl = String(payload.image_url || "").trim();
  const imageBase64 = String(payload.image_base64 || "").trim();
  const imageMimeType = String(payload.image_mime_type || "").trim().toLowerCase();

  if (!imageUrl && !imageBase64 && !imageMimeType) {
    return { error: null, data: null };
  }

  if (imageUrl) {
    return {
      error: "Actualmente solo se admite guardar imagenes embebidas PNG o JPEG",
      data: null,
    };
  }

  if (!imageBase64) {
    return { error: "Debes enviar image_base64 cuando adjuntas una imagen", data: null };
  }

  const dataUrlMatch = imageBase64.match(/^data:(image\/[a-z0-9.+-]+);base64,[a-z0-9+/=\s]+$/i);

  if (!dataUrlMatch) {
    return { error: "La imagen no tiene un formato valido", data: null };
  }

  const detectedMimeType = dataUrlMatch[1].toLowerCase();
  const normalizedMimeType = imageMimeType || detectedMimeType;

  if (normalizedMimeType !== detectedMimeType) {
    return { error: "El tipo MIME de la imagen no coincide con el contenido enviado", data: null };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    return { error: "Solo se permiten imagenes PNG, JPG o JPEG", data: null };
  }

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return {
      error: "La imagen es demasiado grande. Proba con una imagen menor a 5 MB.",
      data: null,
    };
  }

  return {
    error: null,
    data: {
      image_url: null,
      image_base64: imageBase64,
      image_mime_type: normalizedMimeType,
    },
  };
}

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const { errors, data } = validateMaintenancePayload(req.body);
    const imagePayload = parseMaintenanceImagePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (imagePayload.error) {
      return res.status(400).json({ error: imagePayload.error });
    }

    const userId = req.user.id;
    const maintenancePlanId = parseMaintenancePlanId(req.body.maintenance_plan_id);
    if(Number.isNaN(maintenancePlanId)) return res.status(400).json({error:"maintenance_plan_id invalido"});

    await client.query("BEGIN");

    const ownershipResult = await client.query(
      `SELECT
        EXISTS(SELECT 1 FROM vehiculos WHERE id = $1 AND user_id = $3) AS vehicle_ok,
        EXISTS(SELECT 1 FROM lugares WHERE id = $2 AND user_id = $3) AS place_ok,
        ($4::int IS NULL OR EXISTS(SELECT 1 FROM maintenance_plans WHERE id=$4 AND vehicle_id=$1 AND user_id=$3)) AS plan_ok`,
      [data.vehiculo_id, data.lugar_id, userId, maintenancePlanId]
    );

    if (!ownershipResult.rows[0].vehicle_ok || !ownershipResult.rows[0].place_ok || !ownershipResult.rows[0].plan_ok) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vehiculo o lugar no encontrado" });
    }

    const result = await client.query(
      `INSERT INTO mantenimiento
      (fecha, vehiculo_id, lugar_id, accion, km, cost, user_id, maintenance_plan_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.fecha,
        data.vehiculo_id,
        data.lugar_id,
        data.accion,
        data.km,
        data.cost,
        userId, maintenancePlanId,
      ]
    );

    const createdMaintenance = result.rows[0];
    if (maintenancePlanId) await recalculatePlan(client, maintenancePlanId, userId);
    let createdImage = null;

    if (imagePayload.data) {
      const imageResult = await client.query(
        `INSERT INTO maintenance_images (maintenance_id, image_url, image_base64)
         VALUES ($1, $2, $3)
         RETURNING id, maintenance_id, image_url, image_base64, created_at`,
        [
          createdMaintenance.id,
          imagePayload.data.image_url,
          imagePayload.data.image_base64,
        ]
      );

      createdImage = imageResult.rows[0];
    }

    await client.query(
      `UPDATE vehiculos
       SET km_actual = CASE
             WHEN km_actual IS NULL OR km_actual < $1 THEN $1
             ELSE km_actual
           END,
           km_updated_at = CASE
             WHEN km_actual IS NULL OR km_actual < $1 THEN NOW()
             ELSE km_updated_at
           END
       WHERE id = $2 AND user_id = $3`,
      [data.km, data.vehiculo_id, userId]
    );

    await logActivity(client, {
      userId,
      action: "maintenance.create",
      entityType: "maintenance",
      entityId: createdMaintenance.id,
      title: "Mantenimiento creado",
      description: `Registraste "${data.accion}" para el vehiculo seleccionado.`,
      metadata: { vehiculo_id: data.vehiculo_id, lugar_id: data.lugar_id },
    }).catch((error) => {
      console.error("No se pudo registrar la actividad", error);
    });

    await client.query("COMMIT");

    sendPushToUser(pool, {
      userId,
      notification: buildNotificationPayload({
        title: "Nuevo mantenimiento registrado",
        body: `Se registro ${data.accion} para el vehiculo seleccionado.`,
        type: "maintenance-created",
        tag: `maintenance-created-${createdMaintenance.id}`,
        url: buildNotificationIntentUrl({
          vehicleId: data.vehiculo_id,
          maintenanceId: createdMaintenance.id,
          view: "dashboard",
        }),
        data: {
          maintenanceId: createdMaintenance.id,
          vehicleId: data.vehiculo_id,
        },
      }),
    }).catch((pushError) => {
      console.error("No se pudo enviar la notificacion de mantenimiento", pushError);
    });

    res.status(201).json({
      ...createdMaintenance,
      image: createdImage
        ? {
            id: createdImage.id,
            maintenanceId: createdImage.maintenance_id,
            imageUrl: createdImage.image_url,
            imageBase64: createdImage.image_base64,
            imageSource: createdImage.image_url || createdImage.image_base64,
            createdAt: createdImage.created_at,
          }
        : null,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback failures and surface the original error below.
    }
    console.error(error);
    res.status(500).json({ error: "Error al insertar mantenimiento" });
  } finally {
    client.release();
  }
});

router.get("/", async (req, res) => {
  try {
    const conditions = [];
    const values = [];

    const userId = req.user.id;

    values.push(userId);
    conditions.push(`m.user_id = $${values.length}`);

    if (req.query.vehiculo_id) {
      values.push(Number(req.query.vehiculo_id));
      conditions.push(`m.vehiculo_id = $${values.length}`);
    }

    if (req.query.lugar_id) {
      values.push(Number(req.query.lugar_id));
      conditions.push(`m.lugar_id = $${values.length}`);
    }

    if (req.query.from) {
      values.push(req.query.from);
      conditions.push(`m.fecha >= $${values.length}`);
    }

    if (req.query.to) {
      values.push(req.query.to);
      conditions.push(`m.fecha <= $${values.length}`);
    }

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      conditions.push(`(
        LOWER(v.nombre) LIKE LOWER($${values.length}) OR
        LOWER(v.patente) LIKE LOWER($${values.length}) OR
        LOWER(l.nombre) LIKE LOWER($${values.length}) OR
        LOWER(m.accion) LIKE LOWER($${values.length})
      )`);
    }

    const rawLimit = Number(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : null;
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = limit ? `LIMIT ${limit}` : "";

    const result = await pool.query(
      `SELECT
        m.id,
        m.fecha,
        m.vehiculo_id,
        m.lugar_id,
        v.nombre AS vehiculo,
        v.modelo,
        v.patente,
        l.nombre AS lugar,
        l.ubicacion,
        m.accion,
        m.km,
        m.cost,
        m.maintenance_plan_id,
        mp.name AS maintenance_plan_name,
        mi.image_url,
        mi.image_base64,
        COALESCE(mi.image_url, mi.image_base64) AS image_source
      FROM mantenimiento m
      JOIN vehiculos v ON m.vehiculo_id = v.id
      JOIN lugares l ON m.lugar_id = l.id
      LEFT JOIN LATERAL (
        SELECT image_url, image_base64
        FROM maintenance_images
        WHERE maintenance_id = m.id
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) mi ON TRUE
      LEFT JOIN maintenance_plans mp ON mp.id=m.maintenance_plan_id AND mp.user_id=m.user_id
      ${whereClause}
      ORDER BY m.fecha DESC, m.id DESC
      ${limitClause}`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener mantenimientos" });
  }
});

router.post("/:id/images", async (req, res) => {
  try {
    const maintenanceId = Number(req.params.id);
    const userId = req.user.id;
    const imagePayload = parseMaintenanceImagePayload(req.body);

    if (!maintenanceId) {
      return res.status(400).json({ error: "maintenance_id invalido" });
    }

    if (imagePayload.error || !imagePayload.data) {
      return res.status(400).json({ error: imagePayload.error || "Debes enviar una imagen valida" });
    }

    const maintenanceResult = await pool.query(
      "SELECT id FROM mantenimiento WHERE id = $1 AND user_id = $2",
      [maintenanceId, userId]
    );

    if (maintenanceResult.rowCount === 0) {
      return res.status(404).json({ error: "Mantenimiento no encontrado" });
    }

    const insertResult = await pool.query(
      `INSERT INTO maintenance_images (maintenance_id, image_url, image_base64)
       VALUES ($1, $2, $3)
       RETURNING id, maintenance_id, image_url, image_base64, created_at`,
      [maintenanceId, imagePayload.data.image_url, imagePayload.data.image_base64]
    );

    const image = insertResult.rows[0];

    res.status(201).json({
      ok: true,
      image: {
        id: image.id,
        maintenanceId: image.maintenance_id,
        imageUrl: image.image_url,
        imageBase64: image.image_base64,
        imageSource: image.image_url || image.image_base64,
        createdAt: image.created_at,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al guardar la imagen del mantenimiento" });
  }
});

router.get("/:id/images", async (req, res) => {
  try {
    const maintenanceId = Number(req.params.id);
    const userId = req.user.id;

    if (!maintenanceId) {
      return res.status(400).json({ error: "maintenance_id invalido" });
    }

    const result = await pool.query(
      `SELECT
        mi.id,
        mi.maintenance_id,
        mi.image_url,
        mi.image_base64,
        mi.created_at
       FROM maintenance_images mi
       JOIN mantenimiento m ON m.id = mi.maintenance_id
       WHERE mi.maintenance_id = $1
         AND m.user_id = $2
       ORDER BY mi.created_at DESC, mi.id DESC`,
      [maintenanceId, userId]
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        maintenanceId: row.maintenance_id,
        imageUrl: row.image_url,
        imageBase64: row.image_base64,
        imageSource: row.image_url || row.image_base64,
        createdAt: row.created_at,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener las imagenes del mantenimiento" });
  }
});

router.put("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const maintenanceId = Number(req.params.id);
    const userId = req.user.id;
    const maintenancePlanId = parseMaintenancePlanId(req.body.maintenance_plan_id);
    if(Number.isNaN(maintenancePlanId)) return res.status(400).json({error:"maintenance_plan_id invalido"});
    const { errors, data } = validateMaintenancePayload(req.body);

    if (!maintenanceId) {
      return res.status(400).json({ error: "maintenance_id invalido" });
    }
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    await client.query("BEGIN");

    const previousResult = await client.query("SELECT maintenance_plan_id FROM mantenimiento WHERE id=$1 AND user_id=$2 FOR UPDATE", [maintenanceId,userId]);
    if (!previousResult.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({error:"Mantenimiento no encontrado"}); }
    const previousPlanId = previousResult.rows[0].maintenance_plan_id;

    const ownershipResult = await client.query(
      `SELECT
        EXISTS(SELECT 1 FROM vehiculos WHERE id = $1 AND user_id = $3) AS vehicle_ok,
        EXISTS(SELECT 1 FROM lugares WHERE id = $2 AND user_id = $3) AS place_ok,
        ($4::int IS NULL OR EXISTS(SELECT 1 FROM maintenance_plans WHERE id=$4 AND vehicle_id=$1 AND user_id=$3)) AS plan_ok`,
      [data.vehiculo_id, data.lugar_id, userId, maintenancePlanId]
    );

    if (!ownershipResult.rows[0].vehicle_ok || !ownershipResult.rows[0].place_ok || !ownershipResult.rows[0].plan_ok) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vehiculo o lugar no encontrado" });
    }

    const result = await client.query(
      `UPDATE mantenimiento
       SET fecha = $1,
           vehiculo_id = $2,
           lugar_id = $3,
           accion = $4,
           km = $5,
           cost = $6,
           maintenance_plan_id = $9
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [data.fecha, data.vehiculo_id, data.lugar_id, data.accion, data.km, data.cost, maintenanceId, userId, maintenancePlanId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mantenimiento no encontrado" });
    }
    if (previousPlanId) await recalculatePlan(client, previousPlanId, userId);
    if (maintenancePlanId && Number(maintenancePlanId) !== Number(previousPlanId)) await recalculatePlan(client, maintenancePlanId, userId);

    await client.query(
      `UPDATE vehiculos
       SET km_actual = CASE
             WHEN km_actual IS NULL OR km_actual < $1 THEN $1
             ELSE km_actual
           END,
           km_updated_at = CASE
             WHEN km_actual IS NULL OR km_actual < $1 THEN NOW()
             ELSE km_updated_at
           END
       WHERE id = $2 AND user_id = $3`,
      [data.km, data.vehiculo_id, userId]
    );

    await logActivity(client, {
      userId,
      action: "maintenance.update",
      entityType: "maintenance",
      entityId: result.rows[0].id,
      title: "Mantenimiento actualizado",
      description: `Actualizaste el mantenimiento "${result.rows[0].accion}".`,
      metadata: { vehiculo_id: result.rows[0].vehiculo_id, lugar_id: result.rows[0].lugar_id },
    }).catch((error) => {
      console.error("No se pudo registrar la actividad", error);
    });

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback failures and surface the original error below.
    }
    console.error(error);
    res.status(500).json({ error: "Error al actualizar el mantenimiento" });
  } finally {
    client.release();
  }
});


router.delete("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const maintenanceId = Number(req.params.id);
    const userId = req.user.id;

    if (!maintenanceId) {
      return res.status(400).json({ error: "maintenance_id invalido" });
    }

    await client.query("BEGIN");
    const result = await client.query(
      `DELETE FROM mantenimiento
       WHERE id = $1
         AND user_id = $2
       RETURNING id, accion, vehiculo_id, lugar_id, maintenance_plan_id`,
      [maintenanceId, userId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Mantenimiento no encontrado" });
    }
    if(result.rows[0].maintenance_plan_id) await recalculatePlan(client,result.rows[0].maintenance_plan_id,userId);
    await client.query("COMMIT");

    await logActivity(pool, {
      userId,
      action: "maintenance.delete",
      entityType: "maintenance",
      entityId: result.rows[0].id,
      title: "Mantenimiento eliminado",
      description: `Eliminaste el mantenimiento "${result.rows[0].accion}".`,
      metadata: { vehiculo_id: result.rows[0].vehiculo_id, lugar_id: result.rows[0].lugar_id },
    }).catch((error) => {
      console.error("No se pudo registrar la actividad", error);
    });

    res.json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK").catch(()=>{});
    console.error(error);
    res.status(500).json({ error: "Error al eliminar el mantenimiento" });
  } finally { client.release(); }
});

module.exports = router;
