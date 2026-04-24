function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalInteger(value, fieldName, { min = 0, positiveOnly = false } = {}) {
  const normalized = String(value ?? "").trim();

  if (normalized === "") {
    return { value: null, error: null };
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
  const km = Number(payload.km);
  const cost = Number(payload.cost);

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

  if (!isNonNegativeInteger(km)) {
    errors.push("km debe ser un entero mayor o igual a 0");
  }

  if (!isNonNegativeInteger(cost)) {
    errors.push("cost debe ser un entero mayor o igual a 0");
  }

  return {
    errors,
    data: {
      fecha,
      vehiculo_id: vehiculoId,
      lugar_id: lugarId,
      accion,
      km,
      cost,
    },
  };
}

function validateVehiclePayload(payload) {
  const nombre = normalizeText(payload.nombre);
  const modelo = normalizeText(payload.modelo);
  const patente = normalizeText(payload.patente).toUpperCase();

  const kmActual = parseOptionalInteger(payload.km_actual, "km_actual");
  const ultimoServiceKm = parseOptionalInteger(payload.ultimo_service_km, "ultimo_service_km");
  const intervaloKm = parseOptionalInteger(payload.intervalo_km, "intervalo_km", { positiveOnly: true });
  const fechaUltimoService = parseOptionalDate(payload.fecha_ultimo_service, "fecha_ultimo_service");
  const intervaloTiempo = parseOptionalInteger(payload.intervalo_tiempo, "intervalo_tiempo", { positiveOnly: true });

  const errors = [];

  if (!nombre) errors.push("nombre es obligatorio");
  if (!modelo) errors.push("modelo es obligatorio");
  if (!patente) errors.push("patente es obligatoria");

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

module.exports = {
  validateMaintenancePayload,
  validatePlacePayload,
  validateVehiclePayload,
};
