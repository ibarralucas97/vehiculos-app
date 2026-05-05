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
  patente TEXT UNIQUE NOT NULL,
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
