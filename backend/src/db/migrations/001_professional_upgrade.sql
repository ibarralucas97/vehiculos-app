INSERT INTO users (full_name, email, password_hash)
VALUES (
  'Lucas Demo',
  'lucas@mygarage.app',
  '567c0760a4125a2252036835ed28bec8:1b0d50ae8c2c5efb327599a81b203a7c079c37b85ef00bf7f7591479147f29684cc185e3d9ca176f86c8d9d8efdb33fd2df3ac437000b711dc4c8587bef26b55'
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS km_actual INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS ultimo_service_km INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS intervalo_km INTEGER;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS fecha_ultimo_service DATE;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS intervalo_tiempo INTEGER;

ALTER TABLE lugares ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE mantenimiento ADD COLUMN IF NOT EXISTS user_id INTEGER;
ALTER TABLE mantenimiento ALTER COLUMN cost SET DEFAULT 0;
UPDATE mantenimiento SET cost = 0 WHERE cost IS NULL;

UPDATE vehiculos
SET user_id = (SELECT id FROM users WHERE email = 'lucas@mygarage.app')
WHERE user_id IS NULL;

UPDATE lugares
SET user_id = (SELECT id FROM users WHERE email = 'lucas@mygarage.app')
WHERE user_id IS NULL;

UPDATE mantenimiento
SET user_id = (SELECT id FROM users WHERE email = 'lucas@mygarage.app')
WHERE user_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehiculos_user_id_fkey'
  ) THEN
    ALTER TABLE vehiculos
      ADD CONSTRAINT vehiculos_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lugares_user_id_fkey'
  ) THEN
    ALTER TABLE lugares
      ADD CONSTRAINT lugares_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mantenimiento_user_id_fkey'
  ) THEN
    ALTER TABLE mantenimiento
      ADD CONSTRAINT mantenimiento_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
