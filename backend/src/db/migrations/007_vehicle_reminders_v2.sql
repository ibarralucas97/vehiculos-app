ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS vehicle_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS notify_days_before INTEGER NOT NULL DEFAULT 30;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS notify_km_before INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS km_update_reminder_days INTEGER NOT NULL DEFAULT 7;

UPDATE vehiculos
SET
  vehicle_reminders_enabled = COALESCE(vehicle_reminders_enabled, TRUE),
  notify_days_before = COALESCE(notify_days_before, 30),
  notify_km_before = COALESCE(notify_km_before, 1000),
  km_update_reminder_days = COALESCE(km_update_reminder_days, 7);

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

UPDATE push_notification_events
SET
  last_sent_at = COALESCE(last_sent_at, created_at),
  send_count = CASE WHEN send_count < 1 THEN 1 ELSE send_count END,
  last_result = COALESCE(last_result, 'legacy')
WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_notification_events_vehicle_type
  ON push_notification_events (vehicle_id, notification_type, cooldown_until);
