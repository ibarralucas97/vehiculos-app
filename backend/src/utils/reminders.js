const DEFAULT_NOTIFY_DAYS_BEFORE = 30;
const DEFAULT_NOTIFY_KM_BEFORE = 1000;
const DEFAULT_KM_UPDATE_REMINDER_DAYS = 7;
const DEFAULT_REPEAT_DAYS = 7;
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

function normalizePositiveInteger(value, fallback = null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function buildTimeReminder({ lastServiceDate, intervalMonths, notifyDaysBefore }) {
  if (intervalMonths === null) {
    return {
      configured: false,
      status: "unconfigured",
      nextDate: null,
      daysRemaining: null,
      notifyDaysBefore,
    };
  }

  if (!lastServiceDate) {
    return {
      configured: true,
      status: "needs_base",
      nextDate: null,
      daysRemaining: null,
      notifyDaysBefore,
    };
  }

  const nextDate = addMonths(lastServiceDate, intervalMonths);
  const daysRemaining = daysUntil(nextDate);

  if (daysRemaining < 0) {
    return {
      configured: true,
      status: "overdue",
      nextDate,
      daysRemaining,
      notifyDaysBefore,
    };
  }

  if (daysRemaining <= notifyDaysBefore) {
    return {
      configured: true,
      status: "upcoming",
      nextDate,
      daysRemaining,
      notifyDaysBefore,
    };
  }

  return {
    configured: true,
    status: "normal",
    nextDate,
    daysRemaining,
    notifyDaysBefore,
  };
}

function buildKmReminder({ currentKm, lastServiceKm, intervalKm, notifyKmBefore }) {
  if (intervalKm === null) {
    return {
      configured: false,
      status: "unconfigured",
      nextKm: null,
      kmRemaining: null,
      notifyKmBefore,
      currentKm,
    };
  }

  if (lastServiceKm === null) {
    return {
      configured: true,
      status: "needs_base",
      nextKm: null,
      kmRemaining: null,
      notifyKmBefore,
      currentKm,
    };
  }

  const nextKm = lastServiceKm + intervalKm;

  if (currentKm === null) {
    return {
      configured: true,
      status: "needs_current_km",
      nextKm,
      kmRemaining: null,
      notifyKmBefore,
      currentKm,
    };
  }

  const kmRemaining = nextKm - currentKm;

  if (kmRemaining <= 0) {
    return {
      configured: true,
      status: "overdue",
      nextKm,
      kmRemaining,
      notifyKmBefore,
      currentKm,
    };
  }

  if (kmRemaining <= notifyKmBefore) {
    return {
      configured: true,
      status: "upcoming",
      nextKm,
      kmRemaining,
      notifyKmBefore,
      currentKm,
    };
  }

  return {
    configured: true,
    status: "normal",
    nextKm,
    kmRemaining,
    notifyKmBefore,
    currentKm,
  };
}

function buildKmUpdateReminder({ intervalKm, currentKm, kmUpdateReminderDays }) {
  const enabled = intervalKm !== null && kmUpdateReminderDays !== null;
  const needsUpdate = enabled && currentKm === null;

  return {
    enabled,
    needsUpdate,
    intervalDays: kmUpdateReminderDays,
  };
}

function normalizeReminder(vehicle) {
  const latestKm = vehicle.latest_km === null ? null : Number(vehicle.latest_km);
  const currentKm = vehicle.km_actual === null ? latestKm : Number(vehicle.km_actual);
  const lastServiceKm = vehicle.ultimo_service_km === null ? latestKm : Number(vehicle.ultimo_service_km);
  const intervalKm = vehicle.intervalo_km === null ? null : Number(vehicle.intervalo_km);
  const lastServiceDate = vehicle.fecha_ultimo_service || vehicle.latest_fecha || null;
  const intervalMonths = vehicle.intervalo_tiempo === null ? null : Number(vehicle.intervalo_tiempo);
  const vehicleRemindersEnabled = vehicle.vehicle_reminders_enabled !== false;
  const notifyDaysBefore = normalizePositiveInteger(
    vehicle.notify_days_before,
    DEFAULT_NOTIFY_DAYS_BEFORE
  );
  const notifyKmBefore = normalizePositiveInteger(
    vehicle.notify_km_before,
    DEFAULT_NOTIFY_KM_BEFORE
  );
  const kmUpdateReminderDays = normalizePositiveInteger(
    vehicle.km_update_reminder_days,
    DEFAULT_KM_UPDATE_REMINDER_DAYS
  );

  const timeReminder = buildTimeReminder({
    lastServiceDate,
    intervalMonths,
    notifyDaysBefore,
  });

  const kmReminder = buildKmReminder({
    currentKm,
    lastServiceKm,
    intervalKm,
    notifyKmBefore,
  });

  const kmUpdateReminder = buildKmUpdateReminder({
    intervalKm,
    currentKm,
    kmUpdateReminderDays,
  });

  const statusLabels = {
    normal: "Normal",
    proximo: "Proximo",
    atrasado: "Atrasado",
    sin_configurar: "Sin configurar",
    pausado: "Pausados",
  };

  let status = "normal";
  let message = "Todo al dia. Tu proximo mantenimiento aun esta dentro del rango esperado.";

  const hasAnyConfiguredReminder = timeReminder.configured || kmReminder.configured;

  if (!vehicleRemindersEnabled) {
    status = "pausado";
    message = "Los recordatorios de este vehiculo estan desactivados.";
  } else if (timeReminder.status === "overdue" || kmReminder.status === "overdue") {
    status = "atrasado";
    message = timeReminder.status === "overdue" && kmReminder.status === "overdue"
      ? "Tu vehiculo ya necesita atencion por tiempo y kilometraje."
      : timeReminder.status === "overdue"
        ? "El mantenimiento por tiempo ya esta vencido."
        : "El mantenimiento por kilometraje ya esta vencido.";
  } else if (timeReminder.status === "upcoming" || kmReminder.status === "upcoming") {
    status = "proximo";
    message = timeReminder.status === "upcoming" && kmReminder.status === "upcoming"
      ? "Se acercan los proximos mantenimientos por tiempo y kilometraje."
      : timeReminder.status === "upcoming"
        ? "Se acerca el proximo mantenimiento por tiempo."
        : "Se acerca el proximo mantenimiento por kilometraje.";
  } else if (!hasAnyConfiguredReminder) {
    status = "sin_configurar";
    message = "Configura un recordatorio por tiempo o kilometraje para este vehiculo.";
  } else if (
    timeReminder.status === "needs_base" ||
    kmReminder.status === "needs_base" ||
    kmReminder.status === "needs_current_km"
  ) {
    status = "sin_configurar";
    message = "Faltan datos base para calcular los recordatorios con precision.";
  } else if (timeReminder.status === "needs_base" && kmReminder.status === "needs_base") {
    message = "Faltan los datos base del ultimo service para calcular los recordatorios.";
  } else if (kmUpdateReminder.needsUpdate) {
    message = "Actualiza el kilometraje actual para calcular los avisos por kilometraje.";
  } else if (timeReminder.status === "needs_base") {
    message = "Carga la fecha del ultimo service para calcular los avisos por tiempo.";
  } else if (kmReminder.status === "needs_base") {
    message = "Carga el ultimo service en km para calcular los avisos por kilometraje.";
  }

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.nombre,
    vehicleModel: vehicle.modelo,
    plate: vehicle.patente,
    status,
    statusLabel: statusLabels[status],
    message,
    vehicleRemindersEnabled,
    currentKm,
    nextKm: kmReminder.nextKm,
    nextDate: timeReminder.nextDate ? timeReminder.nextDate.toISOString().slice(0, 10) : null,
    kmRemaining: kmReminder.kmRemaining,
    daysRemaining: timeReminder.daysRemaining,
    intervalKm,
    intervalMonths,
    notifyDaysBefore,
    notifyKmBefore,
    kmUpdateReminderDays,
    timeReminder: {
      ...timeReminder,
      nextDate: timeReminder.nextDate ? timeReminder.nextDate.toISOString().slice(0, 10) : null,
    },
    kmReminder,
    kmUpdateReminder,
  };
}

module.exports = {
  DEFAULT_KM_UPDATE_REMINDER_DAYS,
  DEFAULT_NOTIFY_DAYS_BEFORE,
  DEFAULT_NOTIFY_KM_BEFORE,
  DEFAULT_REPEAT_DAYS,
  normalizeReminder,
};
