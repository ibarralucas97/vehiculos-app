const KM_SOON_THRESHOLD = 1000;
const DAY_SOON_THRESHOLD = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function addMonths(dateString, months) {
  const date = new Date(dateString);
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function daysUntil(date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.ceil((target - todayStart) / MS_PER_DAY);
}

function normalizeReminder(vehicle) {
  const latestKm = vehicle.latest_km === null ? null : Number(vehicle.latest_km);
  const currentKm = vehicle.km_actual === null ? latestKm : Number(vehicle.km_actual);
  const lastServiceKm = vehicle.ultimo_service_km === null ? latestKm : Number(vehicle.ultimo_service_km);
  const intervalKm = vehicle.intervalo_km === null ? null : Number(vehicle.intervalo_km);
  const lastServiceDate = vehicle.fecha_ultimo_service || vehicle.latest_fecha || null;
  const intervalMonths = vehicle.intervalo_tiempo === null ? null : Number(vehicle.intervalo_tiempo);

  const nextKm = intervalKm !== null && lastServiceKm !== null ? lastServiceKm + intervalKm : null;
  const nextDate = intervalMonths !== null && lastServiceDate ? addMonths(lastServiceDate, intervalMonths) : null;
  const kmRemaining = nextKm !== null && currentKm !== null ? nextKm - currentKm : null;
  const daysRemaining = nextDate ? daysUntil(nextDate) : null;

  const overdueByKm = kmRemaining !== null && kmRemaining <= 0;
  const overdueByTime = daysRemaining !== null && daysRemaining < 0;
  const soonByKm = kmRemaining !== null && kmRemaining > 0 && kmRemaining <= KM_SOON_THRESHOLD;
  const soonByTime = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= DAY_SOON_THRESHOLD;

  let status = "normal";

  if (overdueByKm || overdueByTime) {
    status = "atrasado";
  } else if (soonByKm || soonByTime) {
    status = "proximo";
  }

  if (nextKm === null && nextDate === null) {
    status = "sin_configurar";
  }

  const labels = {
    normal: "Normal",
    proximo: "Proximo",
    atrasado: "Atrasado",
    sin_configurar: "Sin configurar",
  };

  let message = "Configura un recordatorio por km o por tiempo para este vehiculo.";

  if (status === "normal") {
    message = "Todo al dia. Tu proximo mantenimiento aun esta dentro del rango esperado.";
  }

  if (status === "proximo") {
    message = "Se acerca el proximo mantenimiento. Conviene programarlo pronto.";
  }

  if (status === "atrasado") {
    message = "Este vehiculo ya necesita atencion para evitar gastos sorpresa.";
  }

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.nombre,
    vehicleModel: vehicle.modelo,
    plate: vehicle.patente,
    status,
    statusLabel: labels[status],
    message,
    currentKm,
    nextKm,
    nextDate: nextDate ? nextDate.toISOString().slice(0, 10) : null,
    kmRemaining,
    daysRemaining,
    intervalKm,
    intervalMonths,
  };
}

module.exports = {
  normalizeReminder,
};
