ALTER TABLE push_notification_events
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

ALTER TABLE vehiculos
  ADD COLUMN IF NOT EXISTS photo_public_id TEXT;

CREATE INDEX IF NOT EXISTS idx_push_notification_events_user_read
  ON push_notification_events (user_id, read_at, created_at DESC);
