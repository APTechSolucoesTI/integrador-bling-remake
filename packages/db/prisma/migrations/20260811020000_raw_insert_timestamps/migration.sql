-- Raw integration imports intentionally rely on database-generated timestamps.
-- Prisma's @updatedAt is client-side, so direct SQL inserts also need a DB default.
DO $$
DECLARE
  target RECORD;
BEGIN
  FOR target IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND column_name = 'updated_at'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP',
      target.table_schema,
      target.table_name
    );
  END LOOP;
END
$$;
