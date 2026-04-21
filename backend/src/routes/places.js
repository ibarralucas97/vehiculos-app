const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validatePlacePayload } = require("../utils/validation");

// =====================
// GET /places
// =====================
router.get("/", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      `SELECT id, nombre, ubicacion, contacto_nombre, contacto_numero
       FROM lugares
       WHERE user_id = $1
       ORDER BY id ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener lugares" });
  }
});


// =====================
// POST /places
// =====================
router.post("/", async (req, res) => {
  try {
    const { errors, data } = validatePlacePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const userId = Number(req.body.user_id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const count = await pool.query(
  "SELECT COUNT(*) FROM lugares WHERE user_id = $1",
  [userId]
);

if (Number(count.rows[0].count) >= 30) {
  return res.status(400).json({ error: "Limite de lugares alcanzado" });
}

    const result = await pool.query(
      `INSERT INTO lugares (nombre, ubicacion, contacto_nombre, contacto_numero, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.nombre,
        data.ubicacion,
        data.contacto_nombre,
        data.contacto_numero,
        userId
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear lugar" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const userId = Number(req.body.user_id);
    const id = Number(req.params.id);

    const { nombre, ubicacion, contacto_nombre, contacto_numero } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      `UPDATE lugares
       SET nombre = $1,
           ubicacion = $2,
           contacto_nombre = $3,
           contacto_numero = $4
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [nombre, ubicacion, contacto_nombre, contacto_numero, id, userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar lugar" });
  }
});

// =====================
// DELETE /places/:id
// =====================
router.delete("/:id", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);
    const id = Number(req.params.id);

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const result = await pool.query(
      "DELETE FROM lugares WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Lugar no encontrado" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al eliminar lugar" });
  }
});

module.exports = router;