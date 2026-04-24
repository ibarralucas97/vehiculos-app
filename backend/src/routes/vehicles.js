const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validateVehiclePayload } = require("../utils/validation");

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
        user_id,
        km_actual,
        ultimo_service_km,
        intervalo_km,
        fecha_ultimo_service,
        intervalo_tiempo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.nombre,
        data.modelo,
        data.patente,
        userId,
        data.km_actual,
        data.ultimo_service_km,
        data.intervalo_km,
        data.fecha_ultimo_service,
        data.intervalo_tiempo,
      ]
    );

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
           km_actual = $4,
           ultimo_service_km = $5,
           intervalo_km = $6,
           fecha_ultimo_service = $7,
           intervalo_tiempo = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        data.nombre,
        data.modelo,
        data.patente,
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

    if (!Number.isFinite(kmActual) || kmActual < 0) {
      return res.status(400).json({ error: "km_actual debe ser un numero valido mayor o igual a 0" });
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
       RETURNING id, nombre, modelo, patente, km_actual, ultimo_service_km, intervalo_km, fecha_ultimo_service, intervalo_tiempo`,
      [kmActual, id, userId]
    );

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
      "DELETE FROM vehiculos WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Vehiculo no encontrado" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar vehiculo" });
  }
});

module.exports = router;
