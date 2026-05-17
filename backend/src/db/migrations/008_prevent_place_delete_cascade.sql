DO $$
DECLARE
  existing_delete_rule CHAR;
BEGIN
  SELECT confdeltype
  INTO existing_delete_rule
  FROM pg_constraint
  WHERE conname = 'mantenimiento_lugar_id_fkey'
    AND conrelid = 'mantenimiento'::regclass;

  IF existing_delete_rule IS NOT NULL AND existing_delete_rule <> 'a' THEN
    ALTER TABLE mantenimiento
      DROP CONSTRAINT mantenimiento_lugar_id_fkey;

    ALTER TABLE mantenimiento
      ADD CONSTRAINT mantenimiento_lugar_id_fkey
      FOREIGN KEY (lugar_id) REFERENCES lugares(id) ON DELETE NO ACTION;
  END IF;
END $$;
