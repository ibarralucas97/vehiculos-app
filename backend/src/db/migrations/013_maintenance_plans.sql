CREATE TABLE IF NOT EXISTS maintenance_plans (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_plans_interval_check CHECK (interval_km IS NOT NULL OR interval_months IS NOT NULL),
  CONSTRAINT maintenance_plans_km_check CHECK (
    (interval_km IS NULL AND notify_km_before IS NULL AND initial_service_km IS NULL)
    OR (interval_km > 0 AND notify_km_before >= 0 AND initial_service_km >= 0)
  ),
  CONSTRAINT maintenance_plans_time_check CHECK (
    (interval_months IS NULL AND notify_days_before IS NULL AND initial_service_date IS NULL)
    OR (interval_months > 0 AND notify_days_before >= 0 AND initial_service_date IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_user_vehicle
  ON maintenance_plans (user_id, vehicle_id, is_active);

ALTER TABLE mantenimiento
  ADD COLUMN IF NOT EXISTS maintenance_plan_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mantenimiento_maintenance_plan_id_fkey') THEN
    ALTER TABLE mantenimiento
      ADD CONSTRAINT mantenimiento_maintenance_plan_id_fkey
      FOREIGN KEY (maintenance_plan_id) REFERENCES maintenance_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mantenimiento_plan_latest
  ON mantenimiento (maintenance_plan_id, fecha DESC, id DESC);

ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS maintenance_plan_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_notification_events_maintenance_plan_id_fkey') THEN
    ALTER TABLE push_notification_events
      ADD CONSTRAINT push_notification_events_maintenance_plan_id_fkey
      FOREIGN KEY (maintenance_plan_id) REFERENCES maintenance_plans(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_notification_events_plan
  ON push_notification_events (maintenance_plan_id, notification_type, cooldown_until);
