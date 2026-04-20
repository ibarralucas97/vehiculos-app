function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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
  const errors = [];

  if (!nombre) errors.push("nombre es obligatorio");
  if (!modelo) errors.push("modelo es obligatorio");
  if (!patente) errors.push("patente es obligatoria");

  return { errors, data: { nombre, modelo, patente } };
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
