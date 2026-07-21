const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const {
  MAX_NUMERIC_FIELD_VALUE,
  validateVehiclePayload,
  validateVehicleReminderPayload,
} = require("../utils/validation");
const { logActivity } = require("../utils/activityLog");
const { didMileageChange } = require("../utils/vehicleMileage");

const VEHICLE_RETURNING_FIELDS = `
  id,
  nombre,
  modelo,
  patente,
  vehicle_type,
  vehicle_color,
  km_actual,
  km_updated_at,
  ultimo_service_km,
  intervalo_km,
  fecha_ultimo_service,
  intervalo_tiempo,
  vehicle_reminders_enabled,
  notify_days_before,
  notify_km_before,
  km_update_reminder_days
`;

async function recordActivity(details) {
  try {
    await logActivity(pool, details);
  } catch (error) {
    console.error("No se pudo registrar la actividad", error);
  }
}

function formatPlateLabel(value) {
  return value || "sin patente";
}

router.get("/", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      `SELECT
        id,
        nombre,
        modelo,
        patente,
        vehicle_type,
        vehicle_color,
        km_actual,
        km_updated_at,
        ultimo_service_km,
        intervalo_km,
        fecha_ultimo_service,
        intervalo_tiempo,
        vehicle_reminders_enabled,
        notify_days_before,
        notify_km_before,
        km_update_reminder_days
       FROM vehiculos
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener vehiculos" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { errors, data } = validateVehiclePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const userId = Number(req.body.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const count = await pool.query("SELECT COUNT(*) FROM vehiculos WHERE user_id = $1", [userId]);

    if (Number(count.rows[0].count) >= 3) {
      return res.status(400).json({ error: "Limite de vehiculos alcanzado" });
    }

    const result = await pool.query(
      `INSERT INTO vehiculos (
        nombre,
        modelo,
        patente,
        vehicle_type,
        vehicle_color,
        user_id,
        km_actual,
        km_updated_at,
        ultimo_service_km,
        intervalo_km,
        fecha_ultimo_service,
        intervalo_tiempo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING ${VEHICLE_RETURNING_FIELDS}`,
      [
        data.nombre,
        data.modelo,
        data.patente,
        data.vehicle_type,
        data.vehicle_color,
        userId,
        data.km_actual,
        data.km_actual === null ? null : new Date().toISOString(),
        data.ultimo_service_km,
        data.intervalo_km,
        data.fecha_ultimo_service,
        data.intervalo_tiempo,
      ]
    );

    await recordActivity({
      userId,
      action: "vehicle.create",
      entityType: "vehicle",
      entityId: result.rows[0].id,
      title: "Vehiculo creado",
      description: `Creaste el vehiculo "${result.rows[0].nombre}" (${formatPlateLabel(result.rows[0].patente)}).`,
      metadata: { patente: result.rows[0].patente || null },
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear vehiculo" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    const id = Number(req.params.id);
    const { errors, data } = validateVehiclePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const currentResult = await pool.query(
      "SELECT km_actual FROM vehiculos WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

    const kmChanged = didMileageChange(currentResult.rows[0].km_actual, data.km_actual);

    const result = await pool.query(
      `UPDATE vehiculos
       SET nombre = $1,
           modelo = $2,
           patente = $3,
           vehicle_type = $4,
           vehicle_color = $5,
           km_actual = $6,
           km_updated_at = CASE
             WHEN $11 = FALSE THEN km_updated_at
             WHEN $6 IS NULL THEN NULL
             ELSE NOW()
           END,
           ultimo_service_km = $7,
           intervalo_km = $8,
           fecha_ultimo_service = $9,
           intervalo_tiempo = $10
       WHERE id = $12 AND user_id = $13
       RETURNING ${VEHICLE_RETURNING_FIELDS}`,
      [
        data.nombre,
        data.modelo,
        data.patente,
        data.vehicle_type,
        data.vehicle_color,
        data.km_actual,
        data.ultimo_service_km,
        data.intervalo_km,
        data.fecha_ultimo_service,
        data.intervalo_tiempo,
        kmChanged,
        id,
        userId,
      ]
    );

    await recordActivity({
      userId,
      action: "vehicle.update",
      entityType: "vehicle",
      entityId: result.rows[0].id,
      title: "Vehiculo actualizado",
      description: `Actualizaste el vehiculo "${result.rows[0].nombre}" (${formatPlateLabel(result.rows[0].patente)}).`,
      metadata: { patente: result.rows[0].patente || null },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar vehiculo" });
  }
});

router.patch("/:id/km", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    const id = Number(req.params.id);
    const kmActual = Number(req.body.km_actual);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    if (
      !Number.isInteger(kmActual) ||
      kmActual < 0 ||
      kmActual > MAX_NUMERIC_FIELD_VALUE
    ) {
      return res.status(400).json({
        error: `km_actual debe ser un entero valido entre 0 y ${MAX_NUMERIC_FIELD_VALUE}`,
      });
    }

    const currentResult = await pool.query(
      "SELECT id, km_actual FROM vehiculos WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

    const currentKm = currentResult.rows[0].km_actual;
    const kmChanged = didMileageChange(currentKm, kmActual);

    if (currentKm !== null && Number(kmActual) < Number(currentKm)) {
      return res.status(400).json({ error: "No puedes bajar el kilometraje actual" });
    }

    const result = await pool.query(
      `UPDATE vehiculos
       SET km_actual = $1,
           km_updated_at = CASE
             WHEN $4 = FALSE THEN km_updated_at
             ELSE NOW()
           END
       WHERE id = $2 AND user_id = $3
       RETURNING ${VEHICLE_RETURNING_FIELDS}`,
      [kmActual, id, userId, kmChanged]
    );

    await recordActivity({
      userId,
      action: "vehicle.km.update",
      entityType: "vehicle",
      entityId: result.rows[0].id,
      title: "Kilometraje actualizado",
      description: `Actualizaste el kilometraje de "${result.rows[0].nombre}" a ${result.rows[0].km_actual}.`,
      metadata: { km_actual: result.rows[0].km_actual },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar kilometraje" });
  }
});

router.patch("/:id/reminders", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    const id = Number(req.params.id);
    const { errors, data } = validateVehicleReminderPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const notifyDaysBefore = data.notify_days_before ?? 30;
    const notifyKmBefore = data.notify_km_before ?? 1000;
    const kmUpdateReminderDays = data.km_update_reminder_days ?? 7;

    const result = await pool.query(
      `UPDATE vehiculos
       SET vehicle_reminders_enabled = $1,
           intervalo_tiempo = $2,
           notify_days_before = $3,
           intervalo_km = $4,
           notify_km_before = $5,
           km_update_reminder_days = $6
       WHERE id = $7 AND user_id = $8
       RETURNING ${VEHICLE_RETURNING_FIELDS}`,
      [
        data.vehicle_reminders_enabled,
        data.intervalo_tiempo,
        notifyDaysBefore,
        data.intervalo_km,
        notifyKmBefore,
        kmUpdateReminderDays,
        id,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

    await recordActivity({
      userId,
      action: "vehicle.reminders.update",
      entityType: "vehicle",
      entityId: result.rows[0].id,
      title: "Recordatorios actualizados",
      description: `Actualizaste la configuracion de recordatorios de "${result.rows[0].nombre}".`,
      metadata: {
        vehicle_reminders_enabled: result.rows[0].vehicle_reminders_enabled,
        intervalo_tiempo: result.rows[0].intervalo_tiempo,
        notify_days_before: result.rows[0].notify_days_before,
        intervalo_km: result.rows[0].intervalo_km,
        notify_km_before: result.rows[0].notify_km_before,
        km_update_reminder_days: result.rows[0].km_update_reminder_days,
      },
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar recordatorios del vehiculo" });
  }
});

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = Number(req.query.user_id);
    const id = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    if (!id) {
      return res.status(400).json({ error: "vehicle_id invalido" });
    }

    await client.query("BEGIN");

    const vehicleResult = await client.query(
      "SELECT id, nombre, patente FROM vehiculos WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, userId]
    );

    if (vehicleResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

    const vehicle = vehicleResult.rows[0];

    const maintenanceResult = await client.query(
      "SELECT id FROM mantenimiento WHERE vehiculo_id = $1 AND user_id = $2",
      [id, userId]
    );
    const maintenanceIds = maintenanceResult.rows.map((row) => row.id);

    await client.query(
      `DELETE FROM push_notification_events
       WHERE user_id = $1
         AND (
           vehicle_id = $2
           OR maintenance_id = ANY($3::int[])
         )`,
      [userId, id, maintenanceIds]
    );

    await client.query(
      "DELETE FROM maintenance_images WHERE maintenance_id = ANY($1::int[])",
      [maintenanceIds]
    );

    await client.query(
      "DELETE FROM mantenimiento WHERE vehiculo_id = $1 AND user_id = $2",
      [id, userId]
    );

    await client.query(
      "DELETE FROM vehiculos WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    await client.query("COMMIT");

    await recordActivity({
      userId,
      action: "vehicle.delete",
      entityType: "vehicle",
      entityId: vehicle.id,
      title: "Vehiculo eliminado",
      description: `Eliminaste el vehiculo "${vehicle.nombre}" (${formatPlateLabel(vehicle.patente)}).`,
      metadata: { patente: vehicle.patente || null },
    });

    res.json({ ok: true, id: vehicle.id });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {
      // Ignore rollback failures and surface the original error below.
    }
    console.error(error);
    res.status(500).json({ error: "Error al eliminar vehiculo" });
  } finally {
    client.release();
  }
});

module.exports = router;
