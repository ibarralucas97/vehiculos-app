ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT NOT NULL DEFAULT 'otro';

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS vehicle_color TEXT NOT NULL DEFAULT 'neutro';

UPDATE vehiculos
SET vehicle_type = COALESCE(NULLIF(TRIM(vehicle_type), ''), 'otro'),
    vehicle_color = COALESCE(NULLIF(TRIM(vehicle_color), ''), 'neutro');
