CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  nombre TEXT,
  apellido TEXT,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT,
  profile_photo_url TEXT,
  mileage_unit TEXT NOT NULL DEFAULT 'km',
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  modelo TEXT NOT NULL,
  patente TEXT UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'otro',
  vehicle_color TEXT NOT NULL DEFAULT 'neutro',
  km_actual INTEGER,
  ultimo_service_km INTEGER,
  intervalo_km INTEGER,
  fecha_ultimo_service DATE,
  intervalo_tiempo INTEGER
);

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
  lugar_id INTEGER NOT NULL REFERENCES lugares(id) ON DELETE CASCADE,
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
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_events_user_id
  ON push_notification_events (user_id, created_at DESC);


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
