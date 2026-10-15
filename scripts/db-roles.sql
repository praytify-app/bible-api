-- Least-privilege database roles for Praytify Bible.
--
-- The engine and the gateway share one Postgres database but need nothing of
-- each other's data. Each gets its own login role that OWNS only its own
-- tables, so a compromised engine cannot read developer sessions or OAuth
-- tokens, and a compromised gateway cannot alter scripture.
--
--   bible_engine   owns public.{languages,versions,books,chapters,verses,daily_verses}
--                  and the drizzle schema (engine migrations)
--   bible_gateway  owns public.{user,session,account,verification}
--                  and the platform schema (keys, usage, profiles, gateway migrations)
--
-- Run as a superuser, once per database. Idempotent: safe to rerun, and on an
-- existing database it transfers ownership of tables that already exist.
-- Passwords come from session settings so no secret is written into this file:
--
--   PGOPTIONS="-c bible.engine_password=... -c bible.gateway_password=..." \
--     psql "$SUPERUSER_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db-roles.sql
--
-- Then point the engine's DATABASE_URL at bible_engine and the gateway's at
-- bible_gateway. See docs/DEPLOY.md for the production rollout.

DO $roles$
DECLARE
  engine_pw  text := current_setting('bible.engine_password', true);
  gateway_pw text := current_setting('bible.gateway_password', true);
  db         text := current_database();
  t          record;
BEGIN
  IF coalesce(length(engine_pw), 0) < 16 OR coalesce(length(gateway_pw), 0) < 16 THEN
    RAISE EXCEPTION 'Set bible.engine_password and bible.gateway_password (16+ characters each)';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bible_engine') THEN
    CREATE ROLE bible_engine LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bible_gateway') THEN
    CREATE ROLE bible_gateway LOGIN;
  END IF;
  EXECUTE format('ALTER ROLE bible_engine LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', engine_pw);
  EXECUTE format('ALTER ROLE bible_gateway LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', gateway_pw);

  -- Only these two roles (and superusers) may connect.
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', db);
  EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO bible_engine, bible_gateway', db);
  -- CREATE on the database lets a role create schemas (drizzle's migrator
  -- always issues CREATE SCHEMA IF NOT EXISTS, and Postgres checks the
  -- privilege before IF NOT EXISTS) and trusted extensions (the engine's
  -- pg_trgm). It grants nothing on objects other roles own.
  EXECUTE format('GRANT CREATE ON DATABASE %I TO bible_engine, bible_gateway', db);

  -- Both services create tables in public; ownership keeps them apart, since
  -- a role can only read tables it owns or was granted.
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  GRANT USAGE, CREATE ON SCHEMA public TO bible_engine, bible_gateway;

  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'platform') THEN
    CREATE SCHEMA platform AUTHORIZATION bible_gateway;
  END IF;
  ALTER SCHEMA platform OWNER TO bible_gateway;

  IF NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'drizzle') THEN
    CREATE SCHEMA drizzle AUTHORIZATION bible_engine;
  END IF;
  ALTER SCHEMA drizzle OWNER TO bible_engine;

  -- Existing databases: hand each table (and the sequences it owns) to its service.
  FOR t IN
    SELECT n.nspname, c.relname,
           CASE
             WHEN n.nspname = 'platform' THEN 'bible_gateway'
             WHEN n.nspname = 'drizzle' THEN 'bible_engine'
             WHEN c.relname IN ('user', 'session', 'account', 'verification') THEN 'bible_gateway'
             WHEN c.relname IN ('languages', 'versions', 'books', 'chapters', 'verses', 'daily_verses') THEN 'bible_engine'
           END AS owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm')
      AND n.nspname IN ('public', 'platform', 'drizzle')
  LOOP
    IF t.owner IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I OWNER TO %I', t.nspname, t.relname, t.owner);
    END IF;
  END LOOP;

  -- Sequences not attached to a column (rare) follow their schema's service.
  FOR t IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_depend d ON d.objid = c.oid AND d.deptype IN ('a', 'i')
    WHERE c.relkind = 'S' AND d.objid IS NULL AND n.nspname IN ('platform', 'drizzle')
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', t.nspname, t.relname,
                   CASE t.nspname WHEN 'platform' THEN 'bible_gateway' ELSE 'bible_engine' END);
  END LOOP;
END
$roles$;
