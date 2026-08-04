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

WITH proposed AS (
  SELECT
    id,
    LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^A-Za-z0-9._-]', '_', 'g')) AS base_username
  FROM users
  WHERE username IS NULL
),
ranked AS (
  SELECT
    id,
    CASE
      WHEN base_username ~ '^[A-Za-z0-9._-]{3,32}$' THEN LEFT(base_username, 20)
      ELSE 'usuario'
    END AS safe_username,
    ROW_NUMBER() OVER (
      PARTITION BY CASE
        WHEN base_username ~ '^[A-Za-z0-9._-]{3,32}$' THEN LOWER(LEFT(base_username, 20))
        ELSE 'usuario'
      END
      ORDER BY id
    ) AS collision_index
  FROM proposed
)
UPDATE users u
SET username = CASE
    WHEN ranked.collision_index = 1 THEN ranked.safe_username
    ELSE ranked.safe_username || '_' || u.id
  END,
  must_change_password = TRUE
FROM ranked
WHERE u.id = ranked.id;

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
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'superadmin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_format_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_format_check CHECK (username ~ '^[A-Za-z0-9._-]{3,32}$');
  END IF;
END $$;

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
