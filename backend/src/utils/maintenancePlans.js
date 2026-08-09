const MS_PER_DAY = 86_400_000;

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function addMonths(dateValue, months) {
  const [year, month, day] = dateOnly(dateValue).split("-").map(Number);
  const targetMonth = month - 1 + Number(months);
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function daysBetween(todayValue, targetValue) {
  const today = new Date(`${dateOnly(todayValue)}T00:00:00Z`);
  const target = new Date(`${dateOnly(targetValue)}T00:00:00Z`);
  return Math.round((target - today) / MS_PER_DAY);
}

function calculatePlan(plan, { currentKm = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const nextKm = plan.interval_km == null ? null : Number(plan.last_service_km ?? plan.initial_service_km) + Number(plan.interval_km);
  const baseDate = plan.last_service_date || plan.initial_service_date;
  const nextDate = plan.interval_months == null ? null : addMonths(baseDate, plan.interval_months);
  const kmRemaining = nextKm == null || currentKm == null ? null : nextKm - Number(currentKm);
  const daysRemaining = nextDate == null ? null : daysBetween(today, nextDate);
  const overdue = (kmRemaining !== null && kmRemaining <= 0) || (daysRemaining !== null && daysRemaining < 0);
  const upcoming = !overdue && (
    (kmRemaining !== null && kmRemaining <= Number(plan.notify_km_before || 0)) ||
    (daysRemaining !== null && daysRemaining <= Number(plan.notify_days_before || 0))
  );
  return {
    ...plan,
    next_service_km: nextKm,
    next_service_date: nextDate,
    km_remaining: kmRemaining,
    days_remaining: daysRemaining,
    status: overdue ? "overdue" : upcoming ? "upcoming" : "scheduled",
    status_label: overdue ? "Atrasado" : upcoming ? "Próximo" : "Programado",
  };
}

async function recalculatePlan(client, planId, userId) {
  if (!planId) return null;
  const latest = await client.query(
    `SELECT m.km, m.fecha FROM mantenimiento m
     JOIN maintenance_plans p ON p.id=m.maintenance_plan_id
     WHERE p.id=$1 AND p.user_id=$2 AND m.user_id=$2
     ORDER BY m.fecha DESC,m.id DESC LIMIT 1`,
    [planId, userId]
  );
  const km = latest.rows[0]?.km ?? null;
  const date = latest.rows[0]?.fecha ?? null;
  const result = await client.query(
    `UPDATE maintenance_plans SET
       last_service_km=CASE WHEN interval_km IS NULL THEN NULL ELSE COALESCE($3::int,initial_service_km) END,
       last_service_date=CASE WHEN interval_months IS NULL THEN NULL ELSE COALESCE($4::date,initial_service_date) END,
       next_service_km=CASE WHEN interval_km IS NULL THEN NULL ELSE COALESCE($3::int,initial_service_km)+interval_km END,
       next_service_date=CASE WHEN interval_months IS NULL THEN NULL ELSE (COALESCE($4::date,initial_service_date)+make_interval(months=>interval_months))::date END,
       updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *`,
    [planId,userId,km,date]
  );
  return result.rows[0] || null;
}

module.exports = { addMonths, calculatePlan, recalculatePlan };
