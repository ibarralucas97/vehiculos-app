const express = require("express");
const router = express.Router();
const pool = require("../db/connection");

console.log("🚀 Maintenance router cargado");


// Metodo POST
router.post("/", async (req, res) => {
  try {
    const { fecha, vehiculo_id, lugar_id, accion, km, cost } = req.body;

    const result = await pool.query(
      `INSERT INTO mantenimiento 
      (fecha, vehiculo_id, lugar_id, accion, km, cost)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [fecha, vehiculo_id, lugar_id, accion, km, cost]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al insertar mantenimiento");
  }
});


//Metodo GET
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.id,
        m.fecha,
        v.nombre AS vehiculo,
        l.nombre AS lugar,
        m.accion,
        m.km,
        m.cost
      FROM mantenimiento m
      JOIN vehiculos v ON m.vehiculo_id = v.id
      JOIN lugares l ON m.lugar_id = l.id
      ORDER BY m.fecha DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener mantenimientos");
  }
});

module.exports = router;