/**
 * Database integration tests. Run with a Postgres the tests may create and
 * drop databases on:
 *
 *   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres pnpm test:int
 *
 * Skipped when TEST_DATABASE_URL is unset so `pnpm test` needs no database.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Hono } from "hono";

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const suite = ADMIN_URL ? describe : describe.skip;

const dbName = `gw_it_${Date.now()}`;
const baselineDb = `${dbName}_baseline`;
const urlFor = (name: string) => {
  const u = new URL(ADMIN_URL!);
  u.pathname = `/${name}`;
  return u.toString();
};

// Session lookup is BetterAuth's job and is covered by its own tests; here a
// header stands in for the session cookie.
vi.mock("../../src/lib/session.js", () => ({
  requireSession: async (c: any, next: any) => {
    const id = c.req.header("x-test-user");
    if (!id) return c.json({ error: { code: "UNAUTHENTICATED", message: "no session" } }, 401);
    c.set("user", { id, name: id, email: `${id}@example.test` });
    c.header("cache-control", "no-store");
    return next();
  },
}));

suite("gateway against a real database", () => {
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let app: Hono<any>;
  let flushUsage: () => Promise<void>;
  let aggregate: () => Promise<void>;
  const MIGRATIONS = join(process.cwd(), "drizzle");

  beforeAll(async () => {
    admin = postgres(ADMIN_URL!, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
    await admin.unsafe(`CREATE DATABASE ${baselineDb}`);
    process.env.DATABASE_URL = urlFor(dbName);
    process.env.MAX_KEYS_PER_USER = "3";
    process.env.LOG_LEVEL = process.env.IT_LOG_LEVEL ?? "silent";

    const { runMigrations } = await import("../../src/db/migrate.js");
    await runMigrations(urlFor(dbName), MIGRATIONS);
    sql = postgres(urlFor(dbName), { max: 2, onnotice: () => {} });
    await sql`INSERT INTO "user" (id, name, email) VALUES ('u1', 'One', 'one@example.test'), ('u2', 'Two', 'two@example.test')`;

    const { loadConfig } = await import("../../src/config.js");
    const { createApp } = await import("../../src/app.js");
    const apiKey = await import("../../src/middleware/api-key.js");
    const { MemoryStore, RateLimiter } = await import("../../src/middleware/rate-limit.js");
    const { UsageBuffer, dbUsageSink } = await import("../../src/middleware/usage-logger.js");
    const { keysRouter } = await import("../../src/routes/keys.js");
    const { usageRouter } = await import("../../src/routes/usage.js");
    const { profileRouter, planRouter } = await import("../../src/routes/profile.js");
    ({ aggregateUsage: aggregate } = await import("../../src/jobs/usage-aggregation.js"));

    const cfg = loadConfig({ ...process.env, NODE_ENV: "test", BIBLE_API_URL: "http://engine.test" });
    const resolver = new apiKey.KeyResolver(apiKey.dbKeyLookup, 60_000);
    const usage = new UsageBuffer(dbUsageSink, 500, 0);
    flushUsage = () => usage.flush();
    app = createApp({
      config: cfg,
      resolver,
      lastUsed: new apiKey.LastUsedTracker(apiKey.dbTouchKey, 0),
      limiter: new RateLimiter(new MemoryStore()),
      usage,
      checkDatabase: async () => true,
      mountAccountRoutes: (a) => {
        a.route("/api/dashboard/keys", keysRouter({ maxKeysPerUser: 3, onKeyChanged: (id) => resolver.invalidateKeyId(id) }));
        a.route("/api/dashboard/usage", usageRouter());
        a.route("/api/dashboard/profile", profileRouter());
        a.route("/api/dashboard/plan", planRouter({ anonymous: { perMinute: 120, perDay: 20000 }, maxKeysPerUser: 3 }));
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { headers: { "content-type": "application/json" } }))
    );
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    const { client } = await import("../../src/db/client.js");
    await client.end({ timeout: 5 });
    await sql?.end({ timeout: 5 });
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${baselineDb} WITH (FORCE)`);
    await admin?.end({ timeout: 5 });
  });

  const as = (user: string, init: RequestInit = {}) => ({
    ...init,
    headers: { "content-type": "application/json", "x-test-user": user, ...(init.headers as Record<string, string>) },
  });

  describe("migrations", () => {
    it("records every migration in the gateway's own table and is idempotent", async () => {
      const rows = await sql`SELECT hash FROM platform.__drizzle_migrations`;
      expect(rows).toHaveLength(2);
      const { runMigrations } = await import("../../src/db/migrate.js");
      await runMigrations(urlFor(dbName), MIGRATIONS);
      expect(await sql`SELECT hash FROM platform.__drizzle_migrations`).toHaveLength(2);
      const engineTable = await sql`SELECT to_regclass('drizzle.__drizzle_migrations') AS t`;
      expect(engineTable[0]!.t).toBeNull();
    });

    it("baselines a hand-built schema at 0000 and applies only what is new", async () => {
      const db = postgres(urlFor(baselineDb), { max: 1, onnotice: () => {} });
      try {
        const sql0000 = await readFile(join(MIGRATIONS, "0000_overrated_vision.sql"), "utf8");
        for (const stmt of sql0000.split("--> statement-breakpoint")) if (stmt.trim()) await db.unsafe(stmt);
        const { runMigrations } = await import("../../src/db/migrate.js");
        await runMigrations(urlFor(baselineDb), MIGRATIONS);
        const cols = await db`
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'platform' AND table_name = 'api_keys' AND column_name IN ('kind', 'allowed_origins', 'expires_at')
        `;
        expect(cols).toHaveLength(3);
        expect(await db`SELECT 1 FROM platform.__drizzle_migrations`).toHaveLength(2);
      } finally {
        await db.end({ timeout: 5 });
      }
    });
  });

  describe("key lifecycle", () => {
    let secret: { id: string; key: string };

    it("creates a secret key that works once and is listed by prefix only", async () => {
      const res = await app.request("/api/dashboard/keys", as("u1", { method: "POST", body: JSON.stringify({ name: "Server" }) }));
      expect(res.status).toBe(201);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const body = await res.json();
      secret = body.key;
      expect(secret.key).toMatch(/^pb_sk_/);
      expect(body.key).toMatchObject({ kind: "secret", tier: "free", allowedOrigins: [] });

      const list = await (await app.request("/api/dashboard/keys", as("u1"))).json();
      expect(list.keys).toHaveLength(1);
      expect(list.keys[0].key).toBeUndefined();
      expect(list.keys[0].prefix).toBe(secret.key.slice(0, 12) + "…");

      const call = await app.request("/v1/search?q=love", { headers: { authorization: `Bearer ${secret.key}` } });
      expect(call.status).toBe(200);
    });

    it("does not show one user's keys to another", async () => {
      const list = await (await app.request("/api/dashboard/keys", as("u2"))).json();
      expect(list.keys).toHaveLength(0);
      const del = await app.request(`/api/dashboard/keys/${secret.id}`, as("u2", { method: "DELETE" }));
      expect(del.status).toBe(404);
    });

    it("validates publishable keys and normalises their origins", async () => {
      const bad = await app.request("/api/dashboard/keys", as("u1", { method: "POST", body: JSON.stringify({ kind: "publishable" }) }));
      expect(bad.status).toBe(400);
      const wildcard = await app.request(
        "/api/dashboard/keys",
        as("u1", { method: "POST", body: JSON.stringify({ kind: "publishable", allowedOrigins: ["*"] }) })
      );
      expect(wildcard.status).toBe(400);
      const ok = await app.request(
        "/api/dashboard/keys",
        as("u1", {
          method: "POST",
          body: JSON.stringify({ kind: "publishable", name: "Site", allowedOrigins: ["https://Church.Example/", "https://*.church.example"] }),
        })
      );
      expect(ok.status).toBe(201);
      const pub = (await ok.json()).key;
      expect(pub.allowedOrigins).toEqual(["https://church.example", "https://*.church.example"]);
      const fromSite = await app.request("/v1/search?q=x", {
        headers: { authorization: `Bearer ${pub.key}`, origin: "https://www.church.example" },
      });
      expect(fromSite.status).toBe(200);
    });

    it("enforces the per-account key cap", async () => {
      expect((await app.request("/api/dashboard/keys", as("u1", { method: "POST", body: "{}" }))).status).toBe(201);
      const over = await app.request("/api/dashboard/keys", as("u1", { method: "POST", body: "{}" }));
      expect(over.status).toBe(409);
      expect((await over.json()).error.code).toBe("KEY_LIMIT_REACHED");
    });

    it("renames, then rolls a key so the old one stops working at once", async () => {
      const renamed = await app.request(
        `/api/dashboard/keys/${secret.id}`,
        as("u1", { method: "PATCH", body: JSON.stringify({ name: "Renamed" }) })
      );
      expect((await renamed.json()).key.name).toBe("Renamed");

      const rolled = await app.request(`/api/dashboard/keys/${secret.id}/roll`, as("u1", { method: "POST" }));
      expect(rolled.status).toBe(201);
      const body = await rolled.json();
      expect(body.revokedId).toBe(secret.id);
      expect(body.key.name).toBe("Renamed");

      const oldCall = await app.request("/v1/search?q=x", { headers: { authorization: `Bearer ${secret.key}` } });
      expect(oldCall.status).toBe(401);
      const newCall = await app.request("/v1/search?q=x", { headers: { authorization: `Bearer ${body.key.key}` } });
      expect(newCall.status).toBe(200);
      secret = body.key;
    });

    it("revokes once and then reports not found", async () => {
      expect((await app.request(`/api/dashboard/keys/${secret.id}`, as("u1", { method: "DELETE" }))).status).toBe(200);
      expect((await app.request(`/api/dashboard/keys/${secret.id}`, as("u1", { method: "DELETE" }))).status).toBe(404);
      expect((await app.request("/api/dashboard/keys/not-a-uuid", as("u1", { method: "DELETE" }))).status).toBe(400);
    });

    it("writes last_used_at for keys that were used", async () => {
      const rows = await sql`SELECT COUNT(*)::int AS n FROM platform.api_keys WHERE last_used_at IS NOT NULL`;
      expect(rows[0]!.n).toBeGreaterThan(0);
    });
  });

  describe("usage", () => {
    it("rolls up keyed traffic, including requests just before UTC midnight", async () => {
      await flushUsage();
      const [k] = await sql`SELECT id FROM platform.api_keys WHERE user_id = 'u1' LIMIT 1`;
      const yesterdayLate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()) - 30_000);
      await sql`
        INSERT INTO platform.usage_logs (api_key_id, user_id, method, path, status_code, response_time_ms, created_at)
        VALUES (${k!.id}, 'u1', 'GET', '/v1/x', 200, 10, ${yesterdayLate}), (${k!.id}, 'u1', 'GET', '/v1/x', 500, 30, ${yesterdayLate})
      `;
      await aggregate();

      const daily = await (await app.request("/api/dashboard/usage?days=7", as("u1"))).json();
      const yday = yesterdayLate.toISOString().slice(0, 10);
      expect(daily.daily.find((d: any) => d.date === yday)).toMatchObject({ requests: 2, errors: 1 });

      const summary = (await (await app.request("/api/dashboard/usage/summary", as("u1"))).json()).summary;
      expect(summary.totalRequests).toBeGreaterThanOrEqual(2);
      expect(summary.requestsToday).toBeGreaterThan(0);

      const perKey = (await (await app.request("/api/dashboard/usage/keys", as("u1"))).json()).keys;
      expect(perKey.length).toBeGreaterThan(0);
      expect(perKey[0]).toHaveProperty("name");
    });

    it("keeps other users' usage out of a user's dashboard", async () => {
      const summary = (await (await app.request("/api/dashboard/usage/summary", as("u2"))).json()).summary;
      expect(summary.totalRequests).toBe(0);
      expect(summary.requestsToday).toBe(0);
    });
  });

  describe("profile and plan", () => {
    it("updates only the fields sent", async () => {
      await app.request("/api/dashboard/profile", as("u1", { method: "PUT", body: JSON.stringify({ appName: "Grace Church" }) }));
      const res = await app.request("/api/dashboard/profile", as("u1", { method: "PUT", body: JSON.stringify({ description: "Sunday readings" }) }));
      const p = (await res.json()).profile;
      expect(p).toMatchObject({ appName: "Grace Church", description: "Sunday readings", tier: "free" });
    });

    it("rejects a non-http app URL", async () => {
      const res = await app.request("/api/dashboard/profile", as("u1", { method: "PUT", body: JSON.stringify({ appUrl: "javascript:alert(1)" }) }));
      expect(res.status).toBe(400);
    });

    it("publishes the plan limits the limiter enforces", async () => {
      const plan = await (await app.request("/api/dashboard/plan", as("u1"))).json();
      expect(plan.tier).toBe("free");
      expect(plan.limits.secret).toEqual({ perMinute: 60, perDay: 1000 });
      expect(plan.maxKeys).toBe(3);
    });

    it("puts an internal-tier account on internal limits", async () => {
      await sql`UPDATE platform.developer_profiles SET tier = 'internal' WHERE user_id = 'u1'`;
      const plan = await (await app.request("/api/dashboard/plan", as("u1"))).json();
      expect(plan.limits.secret.perMinute).toBe(6000);
    });
  });
});
