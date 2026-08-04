CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  nombre TEXT,
  apellido TEXT,
  email TEXT UNIQUE,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_changed_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 0,
  telefono TEXT,
  profile_photo_url TEXT,
  mileage_unit TEXT NOT NULL DEFAULT 'km',
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE users
SET is_active = COALESCE(is_approved, TRUE)
WHERE is_approved IS NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^A-Za-z0-9._-]', '_', 'g')),
    must_change_password = TRUE
WHERE username IS NULL
  AND email IS NOT NULL
  AND SPLIT_PART(email, '@', 1) ~ '^[A-Za-z0-9._-]{3,32}$';

UPDATE users
SET username = 'usuario_' || id,
    must_change_password = TRUE
WHERE username IS NULL;

WITH ranked_usernames AS (
  SELECT
    id,
    username,
    ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY id) AS duplicate_index
  FROM users
  WHERE deleted_at IS NULL
),
duplicates AS (
  SELECT
    id,
    LEFT(
      REGEXP_REPLACE(username, '_[0-9]+$', ''),
      GREATEST(1, 31 - LENGTH(id::text))
    ) || '_' || id AS resolved_username
  FROM ranked_usernames
  WHERE duplicate_index > 1
)
UPDATE users u
SET username = duplicates.resolved_username,
    must_change_password = TRUE
FROM duplicates
WHERE u.id = duplicates.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_unique
  ON users (LOWER(username))
  WHERE deleted_at IS NULL;

ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'superadmin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_format_check CHECK (username ~ '^[A-Za-z0-9._-]{3,32}$');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS vehiculos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  modelo TEXT NOT NULL,
  patente TEXT UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'otro',
  vehicle_color TEXT NOT NULL DEFAULT 'neutro',
  km_actual INTEGER,
  km_updated_at TIMESTAMPTZ,
  ultimo_service_km INTEGER,
  intervalo_km INTEGER,
  fecha_ultimo_service DATE,
  intervalo_tiempo INTEGER,
  vehicle_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notify_days_before INTEGER NOT NULL DEFAULT 30,
  notify_km_before INTEGER NOT NULL DEFAULT 1000,
  km_update_reminder_days INTEGER NOT NULL DEFAULT 7,
  photo_url TEXT,
  photo_public_id TEXT
);

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS vehicle_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS notify_days_before INTEGER NOT NULL DEFAULT 30;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS notify_km_before INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS km_update_reminder_days INTEGER NOT NULL DEFAULT 7;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS km_updated_at TIMESTAMPTZ;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS photo_public_id TEXT;

UPDATE vehiculos
SET km_updated_at = NOW()
WHERE km_actual IS NOT NULL
  AND km_updated_at IS NULL;

CREATE TABLE IF NOT EXISTS lugares (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  contacto_nombre TEXT,
  contacto_numero TEXT
);

CREATE TABLE IF NOT EXISTS mantenimiento (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  lugar_id INTEGER NOT NULL REFERENCES lugares(id),
  accion TEXT NOT NULL,
  km INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS maintenance_images (
  id SERIAL PRIMARY KEY,
  maintenance_id INTEGER NOT NULL REFERENCES mantenimiento(id) ON DELETE CASCADE,
  image_url TEXT,
  image_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_images_source_check
    CHECK (image_url IS NOT NULL OR image_base64 IS NOT NULL)
);


CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS push_notification_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehiculos(id) ON DELETE CASCADE,
  maintenance_id INTEGER REFERENCES mantenimiento(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  stage TEXT,
  due_snapshot TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sent_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  send_count INTEGER NOT NULL DEFAULT 0,
  last_result TEXT,
  read_at TIMESTAMPTZ
);

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS stage TEXT;

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS due_snapshot TEXT;

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS send_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS last_result TEXT;

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_push_notification_events_user_id
  ON push_notification_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_events_user_read
  ON push_notification_events (user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notification_events_vehicle_type
  ON push_notification_events (vehicle_id, notification_type, cooldown_until);


CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created_at
  ON activity_logs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON admin_audit_logs (created_at DESC, id DESC);
