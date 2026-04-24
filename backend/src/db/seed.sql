INSERT INTO users (full_name, email, password_hash)
VALUES (
  'Lucas Demo',
  'lucas@mygarage.app',
  '567c0760a4125a2252036835ed28bec8:1b0d50ae8c2c5efb327599a81b203a7c079c37b85ef00bf7f7591479147f29684cc185e3d9ca176f86c8d9d8efdb33fd2df3ac437000b711dc4c8587bef26b55'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO vehiculos (
  user_id,
  nombre,
  modelo,
  patente,
  km_actual,
  ultimo_service_km,
  intervalo_km,
  fecha_ultimo_service,
  intervalo_tiempo
)
SELECT
  u.id,
  'Auto',
  'Gol Trend',
  'ABC123',
  15500,
  15000,
  10000,
  '2026-04-24',
  6
FROM users u
WHERE u.email = 'lucas@mygarage.app'
ON CONFLICT (patente) DO NOTHING;

INSERT INTO lugares (user_id, nombre, ubicacion, contacto_nombre, contacto_numero)
SELECT
  u.id,
  'Taller Juan',
  'Cordoba',
  'Juan Perez',
  '3511234567'
FROM users u
WHERE u.email = 'lucas@mygarage.app'
AND NOT EXISTS (
  SELECT 1 FROM lugares l WHERE l.nombre = 'Taller Juan' AND l.user_id = u.id
);

INSERT INTO mantenimiento (user_id, fecha, vehiculo_id, lugar_id, accion, km, cost)
SELECT
  u.id,
  '2026-04-24',
  v.id,
  l.id,
  'Cambio de aceite',
  15000,
  25000
FROM users u
JOIN vehiculos v ON v.user_id = u.id AND v.patente = 'ABC123'
JOIN lugares l ON l.user_id = u.id AND l.nombre = 'Taller Juan'
WHERE u.email = 'lucas@mygarage.app'
AND NOT EXISTS (
  SELECT 1
  FROM mantenimiento m
  WHERE m.user_id = u.id
    AND m.vehiculo_id = v.id
    AND m.lugar_id = l.id
    AND m.accion = 'Cambio de aceite'
    AND m.km = 15000
);
