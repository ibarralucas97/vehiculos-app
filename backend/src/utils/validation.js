function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

const MAX_NUMERIC_FIELD_VALUE = 999999999;
const ALLOWED_VEHICLE_TYPES = new Set(["moto", "auto", "camioneta", "camion", "bicicleta", "colectivo", "otro"]);
const ALLOWED_VEHICLE_COLORS = new Set(["rojo", "azul", "gris", "negro", "verde", "neutro"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value, defaultValue = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return defaultValue;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isValidPhone(value) {
  const normalized = normalizeText(value);
  return normalized === "" || /^[0-9+\s()\-]{6,20}$/.test(normalized);
}

function parseOptionalInteger(
  value,
  fieldName,
  { min = 0, positiveOnly = false, max = MAX_NUMERIC_FIELD_VALUE } = {}
) {
  const normalized = String(value ?? "").trim();

  if (normalized === "") {
    return { value: null, error: null };
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      value: null,
      error: `${fieldName} debe contener solo numeros enteros`,
    };
  }

  const parsed = Number(normalized);
  const valid = positiveOnly ? isPositiveInteger(parsed) : Number.isInteger(parsed) && parsed >= min;

  if (!valid) {
    return {
      value: null,
      error: positiveOnly
        ? `${fieldName} debe ser un entero positivo`
        : `${fieldName} debe ser un entero mayor o igual a ${min}`,
    };
  }

  if (parsed > max) {
    return {
      value: null,
      error: `${fieldName} no puede superar ${max}`,
    };
  }

  return { value: parsed, error: null };
}

function parseOptionalDate(value, fieldName) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return { value: null, error: null };
  }

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(normalized);

  if (!isValid) {
    return { value: null, error: `${fieldName} debe tener formato YYYY-MM-DD` };
  }

  return { value: normalized, error: null };
}

function validateMaintenancePayload(payload) {
  const fecha = normalizeText(payload.fecha);
  const accion = normalizeText(payload.accion);
  const vehiculoId = Number(payload.vehiculo_id);
  const lugarId = Number(payload.lugar_id);
  const kmResult = parseOptionalInteger(payload.km, "km");
  const costResult = parseOptionalInteger(payload.cost, "cost");

  const errors = [];

  if (!fecha) {
    errors.push("fecha es obligatoria");
  }

  if (!isPositiveInteger(vehiculoId)) {
    errors.push("vehiculo_id debe ser un entero positivo");
  }

  if (!isPositiveInteger(lugarId)) {
    errors.push("lugar_id debe ser un entero positivo");
  }

  if (!accion) {
    errors.push("accion es obligatoria");
  }

  if (kmResult.error) errors.push(kmResult.error);
  if (costResult.error) errors.push(costResult.error);

  return {
    errors,
    data: {
      fecha,
      vehiculo_id: vehiculoId,
      lugar_id: lugarId,
      accion,
      km: kmResult.value ?? 0,
      cost: costResult.value ?? 0,
    },
  };
}

function validateVehiclePayload(payload) {
  const nombre = normalizeText(payload.nombre);
  const modelo = normalizeText(payload.modelo);
  const patente = normalizeText(payload.patente).toUpperCase() || null;
  const vehicleType = normalizeText(payload.vehicle_type || "otro").toLowerCase() || "otro";
  const vehicleColor = normalizeText(payload.vehicle_color || "neutro").toLowerCase() || "neutro";

  const kmActual = parseOptionalInteger(payload.km_actual, "km_actual");
  const ultimoServiceKm = parseOptionalInteger(payload.ultimo_service_km, "ultimo_service_km");
  const intervaloKm = parseOptionalInteger(payload.intervalo_km, "intervalo_km", { positiveOnly: true });
  const fechaUltimoService = parseOptionalDate(payload.fecha_ultimo_service, "fecha_ultimo_service");
  const intervaloTiempo = parseOptionalInteger(payload.intervalo_tiempo, "intervalo_tiempo", { positiveOnly: true });

  const errors = [];

  if (!nombre) errors.push("nombre es obligatorio");
  if (!modelo) errors.push("modelo es obligatorio");
  if (!ALLOWED_VEHICLE_TYPES.has(vehicleType)) errors.push("vehicle_type no es valido");
  if (!ALLOWED_VEHICLE_COLORS.has(vehicleColor)) errors.push("vehicle_color no es valido");

  [kmActual, ultimoServiceKm, intervaloKm, fechaUltimoService, intervaloTiempo].forEach((result) => {
    if (result.error) {
      errors.push(result.error);
    }
  });

  if (
    kmActual.value !== null &&
    ultimoServiceKm.value !== null &&
    kmActual.value < ultimoServiceKm.value
  ) {
    errors.push("km_actual no puede ser menor que ultimo_service_km");
  }

  return {
    errors,
    data: {
      nombre,
      modelo,
      patente,
      vehicle_type: vehicleType,
      vehicle_color: vehicleColor,
      km_actual: kmActual.value,
      ultimo_service_km: ultimoServiceKm.value,
      intervalo_km: intervaloKm.value,
      fecha_ultimo_service: fechaUltimoService.value,
      intervalo_tiempo: intervaloTiempo.value,
    },
  };
}

function validatePlacePayload(payload) {
  const nombre = normalizeText(payload.nombre);
  const ubicacion = normalizeText(payload.ubicacion);
  const contactoNombre = normalizeText(payload.contacto_nombre);
  const contactoNumero = normalizeText(payload.contacto_numero);
  const errors = [];

  if (!nombre) errors.push("nombre es obligatorio");

  return {
    errors,
    data: {
      nombre,
      ubicacion,
      contacto_nombre: contactoNombre,
      contacto_numero: contactoNumero,
    },
  };
}

function validateUserProfilePayload(payload) {
  const nombre = normalizeText(payload.nombre);
  const apellido = normalizeText(payload.apellido);
  const email = normalizeText(payload.email).toLowerCase();
  const telefono = normalizeText(payload.telefono);
  const profilePhotoUrl = normalizeText(payload.profile_photo_url);
  const errors = [];

  if (!nombre) errors.push("nombre es obligatorio");
  if (!apellido) errors.push("apellido es obligatorio");
  if (!email || !isValidEmail(email)) errors.push("email debe ser valido");
  if (!isValidPhone(telefono)) errors.push("telefono debe tener un formato valido");

  return {
    errors,
    data: {
      nombre,
      apellido,
      email,
      telefono,
      profile_photo_url: profilePhotoUrl,
    },
  };
}

function validateUserPreferencesPayload(payload) {
  const mileageUnit = normalizeText(payload.mileage_unit || "km").toLowerCase();
  const remindersEnabled = normalizeBoolean(payload.reminders_enabled, true);
  const errors = [];

  if (!["km", "millas"].includes(mileageUnit)) {
    errors.push("mileage_unit debe ser 'km' o 'millas'");
  }

  return {
    errors,
    data: {
      mileage_unit: mileageUnit,
      reminders_enabled: remindersEnabled,
    },
  };
}

function validatePasswordChangePayload(payload) {
  const currentPassword = String(payload.current_password || "").trim();
  const newPassword = String(payload.new_password || "").trim();
  const confirmPassword = String(payload.confirm_password || "").trim();
  const errors = [];

  if (!currentPassword) errors.push("current_password es obligatoria");
  if (!newPassword || newPassword.length < 6) {
    errors.push("new_password debe tener al menos 6 caracteres");
  }
  if (confirmPassword !== newPassword) {
    errors.push("confirm_password debe coincidir con new_password");
  }
  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push("La nueva contrasena debe ser distinta a la actual");
  }

  return {
    errors,
    data: {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    },
  };
}

module.exports = {
  MAX_NUMERIC_FIELD_VALUE,
  isValidEmail,
  isValidPhone,
  validateMaintenancePayload,
  validatePasswordChangePayload,
  validatePlacePayload,
  validateUserPreferencesPayload,
  validateUserProfilePayload,
  validateVehiclePayload,
};
