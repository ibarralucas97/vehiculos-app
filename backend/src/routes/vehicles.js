const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { MAX_NUMERIC_FIELD_VALUE, validateVehiclePayload } = require("../utils/validation");
const { logActivity } = require("../utils/activityLog");

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
        ultimo_service_km,
        intervalo_km,
        fecha_ultimo_service,
        intervalo_tiempo
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
        ultimo_service_km,
        intervalo_km,
        fecha_ultimo_service,
        intervalo_tiempo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.nombre,
        data.modelo,
        data.patente,
        data.vehicle_type,
        data.vehicle_color,
        userId,
        data.km_actual,
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

    const result = await pool.query(
      `UPDATE vehiculos
       SET nombre = $1,
           modelo = $2,
           patente = $3,
           vehicle_type = $4,
           vehicle_color = $5,
           km_actual = $6,
           ultimo_service_km = $7,
           intervalo_km = $8,
           fecha_ultimo_service = $9,
           intervalo_tiempo = $10
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
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
        id,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

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

    if (currentKm !== null && Number(kmActual) < Number(currentKm)) {
      return res.status(400).json({ error: "No puedes bajar el kilometraje actual" });
    }

    const result = await pool.query(
      `UPDATE vehiculos
       SET km_actual = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, nombre, modelo, patente, vehicle_type, vehicle_color, km_actual, ultimo_service_km, intervalo_km, fecha_ultimo_service, intervalo_tiempo`,
      [kmActual, id, userId]
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

router.delete("/:id", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);
    const id = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      "DELETE FROM vehiculos WHERE id = $1 AND user_id = $2 RETURNING id, nombre, patente",
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

    await recordActivity({
      userId,
      action: "vehicle.delete",
      entityType: "vehicle",
      entityId: result.rows[0].id,
      title: "Vehiculo eliminado",
      description: `Eliminaste el vehiculo "${result.rows[0].nombre}" (${formatPlateLabel(result.rows[0].patente)}).`,
      metadata: { patente: result.rows[0].patente || null },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar vehiculo" });
  }
});

module.exports = router;
