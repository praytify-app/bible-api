import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { log } from "../lib/logger.js";

// Gateway migrations live in their own table. The engine shares this database
// and uses drizzle's default drizzle.__drizzle_migrations; sharing one table
// made whichever service migrated second skip its own first migration.
const MIGRATIONS_SCHEMA = "platform";
const MIGRATIONS_TABLE = "__drizzle_migrations";

// Arbitrary constant: serialises migrations across replicas booting at once.
const MIGRATION_LOCK_ID = 726_310_001;

export const DEFAULT_MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

/**
 * Production was set up by hand from migration 0000 before this runner
 * existed, so its tables exist but no migration is recorded. If the gateway's
 * tables are present and its migrations table is empty, record 0000 as
 * applied so the runner continues from 0001 instead of failing on CREATE TABLE.
 */
async function baselineExistingSchema(sql: postgres.Sql, folder: string): Promise<void> {
  const [state] = await sql`
    SELECT to_regclass('platform.api_keys') IS NOT NULL AS has_tables,
           to_regclass('platform.__drizzle_migrations') IS NOT NULL AS has_journal
  `;
  if (!state!.has_tables) return;
  if (state!.has_journal) {
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM platform.__drizzle_migrations`;
    if (n > 0) return;
  }

  const journal = JSON.parse(await readFile(join(folder, "meta", "_journal.json"), "utf8")) as { entries: JournalEntry[] };
  const first = journal.entries.find((e) => e.idx === 0);
  if (!first) return;
  const query = await readFile(join(folder, `${first.tag}.sql`), "utf8");
  const hash = createHash("sha256").update(query).digest("hex");

  await sql`
    CREATE TABLE IF NOT EXISTS platform.__drizzle_migrations (
      id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
    )
  `;
  await sql`INSERT INTO platform.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${first.when})`;
  log.warn("baselined existing gateway schema at migration 0000", { tag: first.tag });
}

export async function runMigrations(databaseUrl: string, folder = DEFAULT_MIGRATIONS_FOLDER): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    await sql`CREATE SCHEMA IF NOT EXISTS platform`;
    await baselineExistingSchema(sql, folder);
    await migrate(drizzle(sql), {
      migrationsFolder: folder,
      migrationsSchema: MIGRATIONS_SCHEMA,
      migrationsTable: MIGRATIONS_TABLE,
    });
    log.info("gateway migrations complete");
  } finally {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`.catch(() => {});
    await sql.end({ timeout: 5 });
  }
}

// CLI: `node dist/db/migrate.js` or `pnpm db:migrate`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    log.error("DATABASE_URL is required");
    process.exit(1);
  }
  runMigrations(url).then(
    () => process.exit(0),
    (err) => {
      log.error("migration failed", { err });
      process.exit(1);
    }
  );
}
