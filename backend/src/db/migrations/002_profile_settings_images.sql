ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apellido TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mileage_unit TEXT NOT NULL DEFAULT 'km';
ALTER TABLE users ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
SET nombre = COALESCE(NULLIF(nombre, ''), split_part(full_name, ' ', 1))
WHERE COALESCE(nombre, '') = '';

UPDATE users
SET apellido = COALESCE(
  NULLIF(apellido, ''),
  NULLIF(trim(regexp_replace(full_name, '^\S+\s*', '')), '')
)
WHERE COALESCE(apellido, '') = '';

UPDATE users
SET full_name = trim(
  CONCAT(
    COALESCE(NULLIF(nombre, ''), ''),
    CASE
      WHEN COALESCE(NULLIF(apellido, ''), '') <> '' THEN ' ' || apellido
      ELSE ''
    END
  )
)
WHERE COALESCE(full_name, '') = ''
   OR trim(full_name) <> trim(
     CONCAT(
       COALESCE(NULLIF(nombre, ''), ''),
       CASE
         WHEN COALESCE(NULLIF(apellido, ''), '') <> '' THEN ' ' || apellido
         ELSE ''
       END
     )
   );

UPDATE users
SET nombre = COALESCE(NULLIF(nombre, ''), 'Usuario')
WHERE COALESCE(nombre, '') = '';

UPDATE users
SET mileage_unit = 'km'
WHERE mileage_unit IS NULL
   OR mileage_unit NOT IN ('km', 'millas');

UPDATE users
SET reminders_enabled = TRUE
WHERE reminders_enabled IS NULL;

CREATE TABLE IF NOT EXISTS maintenance_images (
  id SERIAL PRIMARY KEY,
  maintenance_id INTEGER NOT NULL REFERENCES mantenimiento(id) ON DELETE CASCADE,
  image_url TEXT,
  image_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'maintenance_images_source_check'
  ) THEN
    ALTER TABLE maintenance_images
      ADD CONSTRAINT maintenance_images_source_check
      CHECK (image_url IS NOT NULL OR image_base64 IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_images_maintenance_id
  ON maintenance_images (maintenance_id, created_at DESC);
