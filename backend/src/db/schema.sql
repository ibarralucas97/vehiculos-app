-- Immutable bootstrap baseline through 013. Empty databases only; never an upgrade script.
-- Historical backfills and demo data are intentionally excluded.
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  nombre TEXT,
  apellido TEXT,
  email TEXT UNIQUE,
  username TEXT NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'superadmin')),
  CONSTRAINT users_username_format_check CHECK (username ~ '^[A-Za-z0-9._-]{3,32}$')
);

CREATE UNIQUE INDEX idx_users_username_lower_unique
  ON users (LOWER(username)) WHERE deleted_at IS NULL;

CREATE TABLE vehiculos (
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

CREATE TABLE lugares (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  contacto_nombre TEXT,
  contacto_numero TEXT
);

CREATE TABLE mantenimiento (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  fecha DATE NOT NULL,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id),
  lugar_id INTEGER NOT NULL REFERENCES lugares(id),
  accion TEXT NOT NULL,
  km INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE maintenance_images (
  id SERIAL PRIMARY KEY,
  maintenance_id INTEGER NOT NULL REFERENCES mantenimiento(id) ON DELETE CASCADE,
  image_url TEXT,
  image_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_images_source_check
    CHECK (image_url IS NOT NULL OR image_base64 IS NOT NULL)
);

CREATE TABLE maintenance_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  interval_km INTEGER,
  notify_km_before INTEGER,
  interval_months INTEGER,
  notify_days_before INTEGER,
  initial_service_km INTEGER,
  initial_service_date DATE,
  last_service_km INTEGER,
  last_service_date DATE,
  next_service_km INTEGER,
  next_service_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_plans_interval_check CHECK (interval_km IS NOT NULL OR interval_months IS NOT NULL),
  CONSTRAINT maintenance_plans_km_check CHECK ((interval_km IS NULL AND notify_km_before IS NULL AND initial_service_km IS NULL) OR (interval_km > 0 AND notify_km_before >= 0 AND initial_service_km >= 0)),
  CONSTRAINT maintenance_plans_time_check CHECK ((interval_months IS NULL AND notify_days_before IS NULL AND initial_service_date IS NULL) OR (interval_months > 0 AND notify_days_before >= 0 AND initial_service_date IS NOT NULL))
);
ALTER TABLE mantenimiento ADD COLUMN IF NOT EXISTS maintenance_plan_id INTEGER;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mantenimiento_maintenance_plan_id_fkey') THEN ALTER TABLE mantenimiento ADD CONSTRAINT mantenimiento_maintenance_plan_id_fkey FOREIGN KEY (maintenance_plan_id) REFERENCES maintenance_plans(id) ON DELETE SET NULL; END IF; END $$;
CREATE INDEX idx_maintenance_plans_user_vehicle ON maintenance_plans(user_id,vehicle_id,is_active);
CREATE INDEX idx_mantenimiento_plan_latest ON mantenimiento(maintenance_plan_id,fecha DESC,id DESC);


CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user_id
  ON push_subscriptions (user_id, updated_at DESC);

CREATE TABLE push_notification_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehiculos(id) ON DELETE CASCADE,
  maintenance_id INTEGER REFERENCES mantenimiento(id) ON DELETE CASCADE,
  maintenance_plan_id INTEGER REFERENCES maintenance_plans(id) ON DELETE CASCADE,
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

CREATE INDEX idx_push_notification_events_user_id
  ON push_notification_events (user_id, created_at DESC);

CREATE INDEX idx_push_notification_events_user_read
  ON push_notification_events (user_id, read_at, created_at DESC);

CREATE INDEX idx_push_notification_events_vehicle_type
  ON push_notification_events (vehicle_id, notification_type, cooldown_until);


CREATE TABLE activity_logs (
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

CREATE INDEX idx_activity_logs_user_created_at
  ON activity_logs (user_id, created_at DESC);

CREATE TABLE admin_audit_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_created_at
  ON admin_audit_logs (created_at DESC, id DESC);

CREATE INDEX idx_maintenance_images_maintenance_id
  ON maintenance_images (maintenance_id, created_at DESC);
CREATE INDEX idx_push_notification_events_plan
  ON push_notification_events (maintenance_plan_id, notification_type, cooldown_until);
