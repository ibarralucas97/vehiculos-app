CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  modelo TEXT NOT NULL,
  patente TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS lugares (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  contacto_nombre TEXT,
  contacto_numero TEXT
);

CREATE TABLE IF NOT EXISTS mantenimiento (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id),
  lugar_id INTEGER NOT NULL REFERENCES lugares(id),
  accion TEXT NOT NULL,
  km INTEGER NOT NULL,
  cost INTEGER NOT NULL
);
