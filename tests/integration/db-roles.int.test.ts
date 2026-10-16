/**
 * Proves scripts/db-roles.sql isolates the engine and the gateway: each role
 * owns only its own tables, on a fresh install and when migrating a database
 * that was built with one shared superuser (production today).
 *
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres pnpm test:int
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const suite = ADMIN_URL ? describe : describe.skip;

const stamp = Date.now();
const freshDb = `roles_fresh_${stamp}`;
const legacyDb = `roles_legacy_${stamp}`;
const extDb = `roles_ext_${stamp}`;
const ENGINE_PW = "engine-password-for-tests-0001";
const GATEWAY_PW = "gateway-password-for-tests-001";

function urlFor(db: string, user?: string, password?: string): string {
  const u = new URL(ADMIN_URL!);
  u.pathname = `/${db}`;
  if (user) {
    u.username = user;
    u.password = password ?? "";
  }
  return u.toString();
}

async function applyRoles(db: string): Promise<void> {
  const sql = postgres(urlFor(db), { max: 1, onnotice: () => {} });
  try {
    const script = await readFile(join(process.cwd(), "scripts", "db-roles.sql"), "utf8");
    await sql.unsafe(`SET bible.engine_password = '${ENGINE_PW}'; SET bible.gateway_password = '${GATEWAY_PW}';\n${script}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function denied(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "allowed";
  } catch (err) {
    return (err as { code?: string }).code ?? "error";
  }
}

const ENGINE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS public.languages (id serial PRIMARY KEY, code text);
  CREATE TABLE IF NOT EXISTS public.verses (id serial PRIMARY KEY, text text);
  INSERT INTO public.verses (text) VALUES ('In the beginning');
`;

suite("least-privilege database roles", () => {
  let admin: postgres.Sql;
  const open: postgres.Sql[] = [];
  const connect = (db: string, user?: string, pw?: string) => {
    const c = postgres(urlFor(db, user, pw), { max: 1, onnotice: () => {} });
    open.push(c);
    return c;
  };

  beforeAll(async () => {
    admin = postgres(ADMIN_URL!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${freshDb}`);
    await admin.unsafe(`CREATE DATABASE ${legacyDb}`);
    await admin.unsafe(`CREATE DATABASE ${extDb}`);
    process.env.LOG_LEVEL = "silent";
  });

  afterAll(async () => {
    for (const c of open) await c.end({ timeout: 5 }).catch(() => {});
    await admin.unsafe(`DROP DATABASE IF EXISTS ${freshDb} WITH (FORCE)`);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${legacyDb} WITH (FORCE)`);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${extDb} WITH (FORCE)`);
    await admin.end({ timeout: 5 });
  });

  describe("fresh install", () => {
    it("lets each service migrate as its own role", async () => {
      await applyRoles(freshDb);
      const { runMigrations } = await import("../../src/db/migrate.js");
      await runMigrations(urlFor(freshDb, "bible_gateway", GATEWAY_PW), join(process.cwd(), "drizzle"));

      const engine = connect(freshDb, "bible_engine", ENGINE_PW);
      await engine.unsafe(ENGINE_TABLES_SQL);
      // The engine's migration needs the trusted pg_trgm extension.
      await engine.unsafe("CREATE EXTENSION IF NOT EXISTS pg_trgm");

      const owners = await connect(freshDb)`
        SELECT n.nspname || '.' || c.relname AS name, pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname IN ('public', 'platform')
      `;
      const byName = Object.fromEntries(owners.map((r) => [r.name, r.owner]));
      expect(byName["platform.api_keys"]).toBe("bible_gateway");
      expect(byName["public.session"]).toBe("bible_gateway");
      expect(byName["public.verses"]).toBe("bible_engine");
    });

    it("keeps the gateway out of scripture tables and the engine out of accounts and keys", async () => {
      const gateway = connect(freshDb, "bible_gateway", GATEWAY_PW);
      const engine = connect(freshDb, "bible_engine", ENGINE_PW);

      expect(await denied(() => gateway`SELECT * FROM public.verses`)).toBe("42501");
      expect(await denied(() => gateway`UPDATE public.verses SET text = 'x'`)).toBe("42501");
      expect(await denied(() => engine`SELECT * FROM public.session`)).toBe("42501");
      expect(await denied(() => engine`SELECT * FROM public.account`)).toBe("42501");
      expect(await denied(() => engine`SELECT * FROM platform.api_keys`)).toBe("42501");
      expect(await denied(() => engine`CREATE TABLE platform.sneaky (id int)`)).toBe("42501");

      // Each still works on its own data.
      await gateway`INSERT INTO public."user" (id, name, email) VALUES ('u1', 'One', 'one@example.test')`;
      await gateway`INSERT INTO platform.api_keys (user_id, name, key_hash, key_prefix) VALUES ('u1', 'k', 'h', 'p')`;
      expect((await engine`SELECT count(*)::int AS n FROM public.verses`)[0]!.n).toBe(1);
    });

    it("cannot escalate: no new roles or databases, and no taking another service's objects", async () => {
      const gateway = connect(freshDb, "bible_gateway", GATEWAY_PW);
      const engine = connect(freshDb, "bible_engine", ENGINE_PW);
      expect(await denied(() => gateway.unsafe("CREATE ROLE evil"))).toBe("42501");
      expect(await denied(() => gateway.unsafe("CREATE DATABASE evil"))).toBe("42501");
      expect(await denied(() => gateway.unsafe("ALTER TABLE public.verses OWNER TO bible_gateway"))).toBe("42501");
      expect(await denied(() => engine.unsafe("ALTER SCHEMA platform OWNER TO bible_engine"))).toBe("42501");
      expect(await denied(() => engine.unsafe("DROP TABLE platform.api_keys"))).toBe("42501");
    });
  });

  describe("migrating a shared-superuser database", () => {
    it("hands every existing table to its service and is safe to rerun", async () => {
      // Production today: everything created by one superuser.
      const { runMigrations } = await import("../../src/db/migrate.js");
      await runMigrations(urlFor(legacyDb), join(process.cwd(), "drizzle"));
      await connect(legacyDb).unsafe(ENGINE_TABLES_SQL);

      await applyRoles(legacyDb);
      await applyRoles(legacyDb);

      const rows = await connect(legacyDb)`
        SELECT n.nspname || '.' || c.relname AS name, pg_get_userbyid(c.relowner) AS owner
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'S') AND n.nspname IN ('public', 'platform')
      `;
      const notMoved = rows.filter((r) => r.owner !== "bible_gateway" && r.owner !== "bible_engine");
      expect(notMoved).toEqual([]);

      // The gateway can keep migrating and serving after the switch.
      await runMigrations(urlFor(legacyDb, "bible_gateway", GATEWAY_PW), join(process.cwd(), "drizzle"));
      const gateway = connect(legacyDb, "bible_gateway", GATEWAY_PW);
      expect((await gateway`SELECT count(*)::int AS n FROM platform.api_keys`)[0]!.n).toBe(0);
      expect(await denied(() => gateway`SELECT * FROM public.verses`)).toBe("42501");
    });

    it("refuses to run without both passwords", async () => {
      const sql = connect(legacyDb);
      const script = await readFile(join(process.cwd(), "scripts", "db-roles.sql"), "utf8");
      expect(await denied(() => sql.unsafe(script))).toBe("P0001");
    });
  });

  // Production keeps pg_trgm in a schema named after the old shared user,
  // reached through the default "$user" search path. The first rollout left the
  // engine role without it, and trigram search failed with "function
  // similarity(text, unknown) does not exist".
  describe("extensions outside public", () => {
    beforeAll(async () => {
      const owner = connect(extDb);
      await owner.unsafe("CREATE SCHEMA legacy_ext; CREATE EXTENSION pg_trgm SCHEMA legacy_ext;");
      await owner.unsafe(ENGINE_TABLES_SQL);
      await applyRoles(extDb);
    });

    it("lets the engine call pg_trgm unqualified", async () => {
      const engine = connect(extDb, "bible_engine", ENGINE_PW);
      const [row] = await engine`SELECT similarity('shepherd', 'shepherds') > 0.5 AS close, 'lord' % 'lords' AS match`;
      expect(row).toEqual({ close: true, match: true });
    });
  });
});
