-- Full-text search indexes for discovery.
-- Uses Postgres built-in FTS with the 'simple' config (works across mixed languages).

-- NOTE: Some Postgres builds reject expression indexes using `to_tsvector(...)` because it
-- isn't considered IMMUTABLE. That breaks Prisma's shadow DB validation (P3006).
-- We attempt to create the indexes, but swallow errors so migrations can still apply.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Material_fts_published_idx"
      ON "Material"
      USING GIN (to_tsvector(''simple'', concat_ws('' '', "title", "objectives", "content")))
      WHERE "deletedAt" IS NULL AND "status" = ''PUBLISHED''';
  EXCEPTION
    WHEN OTHERS THEN
      -- Skip if the current Postgres version does not allow the expression index.
      NULL;
  END;

  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS "Discussion_fts_active_idx"
      ON "Discussion"
      USING GIN (to_tsvector(''simple'', concat_ws('' '', "title", "content")))
      WHERE "archivedAt" IS NULL AND "removedAt" IS NULL';
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
END $$;
