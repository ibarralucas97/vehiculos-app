-- ALTER TABLE examples
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS km_actual INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS ultimo_service_km INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS intervalo_km INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS fecha_ultimo_service DATE;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS intervalo_tiempo INTEGER;
ALTER TABLE mantenimiento ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE lugares ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- INSERT example
INSERT INTO mantenimiento (fecha, vehiculo_id, lugar_id, accion, km, cost, user_id)
VALUES ('2026-04-24', 1, 1, 'Cambio de aceite', 15000, 25000, 1);

-- UPDATE example
UPDATE vehiculos
SET km_actual = 15500,
    ultimo_service_km = 15000,
    intervalo_km = 10000,
    fecha_ultimo_service = '2026-04-24',
    intervalo_tiempo = 6
WHERE id = 1;

-- Monthly spend
SELECT COALESCE(SUM(cost), 0) AS gasto_mensual
FROM mantenimiento
WHERE user_id = 1
  AND vehiculo_id = 1
  AND date_trunc('month', fecha::timestamp) = date_trunc('month', CURRENT_DATE::timestamp);

-- Total spend
SELECT COALESCE(SUM(cost), 0) AS gasto_total
FROM mantenimiento
WHERE user_id = 1
  AND vehiculo_id = 1;

-- Next maintenances helper query
SELECT
  id,
  nombre,
  modelo,
  patente,
  km_actual,
  ultimo_service_km,
  intervalo_km,
  fecha_ultimo_service,
  intervalo_tiempo
FROM vehiculos
WHERE user_id = 1;


-- Centralized kilometer examples
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS km_actual INTEGER;

UPDATE vehiculos
SET km_actual = 18250
WHERE id = 1
  AND user_id = 1;

SELECT id, nombre, km_actual
FROM vehiculos
WHERE id = 1
  AND user_id = 1;
