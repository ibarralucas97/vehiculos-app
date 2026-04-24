const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { normalizeReminder } = require("../utils/reminders");

router.get("/overview", async (req, res) => {
  try {
    const userId = Number(req.query.user_id);
    const vehicleId = Number(req.query.vehiculo_id || 0) || null;

    if (!userId) {
      return res.status(400).json({ error: "user_id requerido" });
    }

    const vehiclesResult = await pool.query(
      `SELECT
        v.id,
        v.nombre,
        v.modelo,
        v.patente,
        v.km_actual,
        v.ultimo_service_km,
        v.intervalo_km,
        v.fecha_ultimo_service,
        v.intervalo_tiempo,
        lm.fecha AS latest_fecha,
        lm.km AS latest_km
      FROM vehiculos v
      LEFT JOIN LATERAL (
        SELECT fecha, km
        FROM mantenimiento m
        WHERE m.user_id = $1 AND m.vehiculo_id = v.id
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE v.user_id = $1
      ORDER BY v.nombre ASC, v.id ASC`,
      [userId]
    );

    const reminders = vehiclesResult.rows.map(normalizeReminder);
    const selectedReminder = vehicleId
      ? reminders.find((item) => item.vehicleId === vehicleId) || null
      : null;

    const alertItems = reminders
      .filter((item) => item.status === "proximo" || item.status === "atrasado")
      .sort((a, b) => {
        const priority = { atrasado: 0, proximo: 1, normal: 2, sin_configurar: 3 };
        return priority[a.status] - priority[b.status];
      });

    const spendValues = [userId];
    let spendWhere = "user_id = $1";

    if (vehicleId) {
      spendValues.push(vehicleId);
      spendWhere += ` AND vehiculo_id = $${spendValues.length}`;
    }

    const monthlyResult = await pool.query(
      `SELECT COALESCE(SUM(cost), 0) AS total
       FROM mantenimiento
       WHERE ${spendWhere}
         AND date_trunc('month', fecha::timestamp) = date_trunc('month', CURRENT_DATE::timestamp)`,
      spendValues
    );

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(cost), 0) AS total
       FROM mantenimiento
       WHERE ${spendWhere}`,
      spendValues
    );

    res.json({
      monthlySpend: Number(monthlyResult.rows[0].total || 0),
      totalSpend: Number(totalResult.rows[0].total || 0),
      selectedReminder,
      alerts: alertItems,
      vehicleCount: reminders.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el overview del dashboard" });
  }
});

module.exports = router;
