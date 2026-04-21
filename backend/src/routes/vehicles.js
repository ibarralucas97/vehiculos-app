const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validateVehiclePayload } = require("../utils/validation");

// =====================
// GET /vehicles
// =====================
router.get("/", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      "SELECT id, nombre, modelo, patente FROM vehiculos WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener vehiculos" });
  }
});


// =====================
// POST /vehicles
// =====================
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

    const count = await pool.query(
  "SELECT COUNT(*) FROM vehiculos WHERE user_id = $1",
  [userId]
);

if (Number(count.rows[0].count) >= 3) {
  return res.status(400).json({ error: "Limite de vehiculos alcanzado" });
}

    const result = await pool.query(
      `INSERT INTO vehiculos (nombre, modelo, patente, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.nombre, data.modelo, data.patente, userId]
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

    const { nombre, modelo, patente } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      `UPDATE vehiculos
       SET nombre = $1,
           modelo = $2,
           patente = $3
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [nombre, modelo, patente, id, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar vehiculo" });
  }
});

// =====================
// DELETE /vehicles/:id
// =====================
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