const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validateVehiclePayload } = require("../utils/validation");

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, modelo, patente FROM vehiculos ORDER BY id ASC"
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

    const result = await pool.query(
      `INSERT INTO vehiculos (nombre, modelo, patente)
      VALUES ($1, $2, $3)
      RETURNING *`,
      [data.nombre, data.modelo, data.patente]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear vehiculo" });
  }
});

module.exports = router;
