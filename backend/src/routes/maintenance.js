const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { validateMaintenancePayload } = require("../utils/validation");

router.post("/", async (req, res) => {
  try {
    const { errors, data } = validateMaintenancePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const result = await pool.query(
      `INSERT INTO mantenimiento
      (fecha, vehiculo_id, lugar_id, accion, km, cost)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [data.fecha, data.vehiculo_id, data.lugar_id, data.accion, data.km, data.cost]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al insertar mantenimiento" });
  }
});

router.get("/", async (req, res) => {
  try {
    const conditions = [];
    const values = [];

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
      conditions.push(`(LOWER(v.nombre) LIKE LOWER($${values.length}) OR LOWER(v.patente) LIKE LOWER($${values.length}) OR LOWER(l.nombre) LIKE LOWER($${values.length}) OR LOWER(m.accion) LIKE LOWER($${values.length}))`);
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
        m.cost
      FROM mantenimiento m
      JOIN vehiculos v ON m.vehiculo_id = v.id
      JOIN lugares l ON m.lugar_id = l.id
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

module.exports = router;

