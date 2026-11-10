-- Runtime role of the deployed app (Lab 10, chapter 4): read/write data, no DDL.
-- Run ONCE as the owner role that runs `prisma migrate deploy` (Neon: the database owner),
-- e.g. in the Neon SQL Editor, AFTER the role exists:
--
--   CREATE ROLE shop_app WITH LOGIN PASSWORD '<type a long random password here, never commit it>';
--
-- Then the app's DATABASE_URL uses shop_app (pooled endpoint); migrations keep using the owner
-- (direct endpoint). Safe to run again. Tests: tests/integration/app-role.test.ts.

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO shop_app', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO shop_app;
REVOKE CREATE ON SCHEMA public FROM shop_app;

-- Existing tables and sequences created by the migrations so far.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO shop_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO shop_app;

-- Tables and sequences created by FUTURE migrations of this owner get the same rights.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO shop_app;

-- The migration history belongs to the migration process only.
DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    REVOKE ALL ON TABLE "_prisma_migrations" FROM shop_app;
  END IF;
END
$$;
