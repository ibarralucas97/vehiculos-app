const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const { addMonths, calculatePlan } = require("../utils/maintenancePlans");

function optionalInteger(value, { min = 0 } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min ? parsed : NaN;
}

function validate(payload = {}) {
  const name = String(payload.name || "").trim();
  const intervalKm = optionalInteger(payload.interval_km, { min: 1 });
  const intervalMonths = optionalInteger(payload.interval_months, { min: 1 });
  const notifyKmBefore = intervalKm === null ? null : optionalInteger(payload.notify_km_before ?? 0);
  const notifyDaysBefore = intervalMonths === null ? null : optionalInteger(payload.notify_days_before ?? 0);
  const initialServiceKm = intervalKm === null ? null : optionalInteger(payload.initial_service_km);
  const initialServiceDate = intervalMonths === null ? null : String(payload.initial_service_date || "").slice(0, 10);
  const errors = [];
  if (!name || name.length > 100) errors.push("El tipo debe tener entre 1 y 100 caracteres");
  if (intervalKm === null && intervalMonths === null) errors.push("Configura un intervalo por kilometraje o por tiempo");
  if ([intervalKm, intervalMonths, notifyKmBefore, notifyDaysBefore, initialServiceKm].some(Number.isNaN)) errors.push("Los valores numericos deben ser enteros validos");
  if (intervalKm !== null && initialServiceKm === null) errors.push("Indica el kilometraje real del ultimo servicio");
  if (intervalMonths !== null && !/^\d{4}-\d{2}-\d{2}$/.test(initialServiceDate)) errors.push("Indica la fecha real del ultimo servicio");
  return { errors, data: { name, intervalKm, intervalMonths, notifyKmBefore, notifyDaysBefore, initialServiceKm, initialServiceDate, isActive: payload.is_active !== false } };
}

router.get("/", async (req, res) => {
  const userId = req.user.id;
  const vehicleId = Number(req.query.vehicle_id || req.query.vehiculo_id);
  if (!vehicleId) return res.status(400).json({ error: "vehicle_id invalido" });
  const vehicle = await pool.query("SELECT id, km_actual FROM vehiculos WHERE id = $1 AND user_id = $2", [vehicleId, userId]);
  if (!vehicle.rowCount) return res.status(404).json({ error: "Vehiculo no encontrado" });
  const result = await pool.query("SELECT * FROM maintenance_plans WHERE vehicle_id = $1 AND user_id = $2 ORDER BY id", [vehicleId, userId]);
  res.json(result.rows.map((plan) => calculatePlan(plan, { currentKm: vehicle.rows[0].km_actual })));
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user.id;
    const vehicleId = Number(req.body.vehicle_id || req.body.vehiculo_id);
    const checked = validate(req.body);
    if (checked.errors.length) return res.status(400).json({ errors: checked.errors });
    const vehicle = await pool.query("SELECT id, km_actual FROM vehiculos WHERE id = $1 AND user_id = $2", [vehicleId, userId]);
    if (!vehicle.rowCount) return res.status(404).json({ error: "Vehiculo no encontrado" });
    const d = checked.data;
    const nextKm=d.intervalKm===null?null:d.initialServiceKm+d.intervalKm;
    const nextDate=d.intervalMonths===null?null:addMonths(d.initialServiceDate,d.intervalMonths);
    const result = await pool.query(
      `INSERT INTO maintenance_plans (user_id, vehicle_id, name, is_active, interval_km, notify_km_before,
       interval_months, notify_days_before, initial_service_km, initial_service_date, last_service_km,
       last_service_date, next_service_km, next_service_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$9,$10,$11,$12)
       RETURNING *`,
      [userId, vehicleId, d.name, d.isActive, d.intervalKm, d.notifyKmBefore, d.intervalMonths, d.notifyDaysBefore, d.initialServiceKm, d.initialServiceDate, nextKm, nextDate]
    );
    res.status(201).json(calculatePlan(result.rows[0], { currentKm: vehicle.rows[0].km_actual }));
  } catch (error) { console.error(error); res.status(500).json({ error: "Error al crear el plan" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id); const userId = req.user.id; const vehicleId = Number(req.body.vehicle_id || req.body.vehiculo_id);
    const checked = validate(req.body); if (checked.errors.length) return res.status(400).json({ errors: checked.errors });
    const owned = await pool.query(`SELECT p.id FROM maintenance_plans p JOIN vehiculos v ON v.id=p.vehicle_id WHERE p.id=$1 AND p.user_id=$2 AND p.vehicle_id=$3 AND v.user_id=$2`, [id,userId,vehicleId]);
    if (!owned.rowCount) return res.status(404).json({ error: "Plan no encontrado" });
    const d=checked.data;
    await pool.query(`UPDATE maintenance_plans SET name=$1,is_active=$2,interval_km=$3,notify_km_before=$4,interval_months=$5,notify_days_before=$6,initial_service_km=$7,initial_service_date=$8,updated_at=NOW() WHERE id=$9 AND user_id=$10`, [d.name,d.isActive,d.intervalKm,d.notifyKmBefore,d.intervalMonths,d.notifyDaysBefore,d.initialServiceKm,d.initialServiceDate,id,userId]);
    const { recalculatePlan } = require("../utils/maintenancePlans"); await recalculatePlan(pool,id,userId);
    const result=await pool.query(`SELECT p.*,v.km_actual FROM maintenance_plans p JOIN vehiculos v ON v.id=p.vehicle_id WHERE p.id=$1 AND p.user_id=$2`,[id,userId]);
    res.json(calculatePlan(result.rows[0],{currentKm:result.rows[0].km_actual}));
  } catch(error){console.error(error);res.status(500).json({error:"Error al actualizar el plan"});}
});

router.delete("/:id", async (req,res) => {
  const result=await pool.query("DELETE FROM maintenance_plans WHERE id=$1 AND user_id=$2 RETURNING id",[Number(req.params.id),req.user.id]);
  if(!result.rowCount)return res.status(404).json({error:"Plan no encontrado"});
  res.json({ok:true,id:result.rows[0].id});
});

module.exports = router;
