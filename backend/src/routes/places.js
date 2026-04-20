const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validatePlacePayload } = require("../utils/validation");

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, ubicacion, contacto_nombre, contacto_numero
       FROM lugares
       ORDER BY id ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener lugares" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { errors, data } = validatePlacePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await pool.query(
      `INSERT INTO lugares (nombre, ubicacion, contacto_nombre, contacto_numero)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [data.nombre, data.ubicacion, data.contacto_nombre, data.contacto_numero]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear lugar" });
  }
});

module.exports = router;
