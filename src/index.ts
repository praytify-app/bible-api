import { serve } from "@hono/node-server";
import { assertProductionReady, config, configWarnings } from "./config.js";
import { apiError } from "./lib/errors.js";
import { log, setLogLevel } from "./lib/logger.js";
import { createApp } from "./app.js";
import { dbKeyLookup, dbTouchKey, KeyResolver, LastUsedTracker } from "./middleware/api-key.js";
import { createReadCache } from "./middleware/proxy.js";
import { createRateLimitStore, RateLimiter } from "./middleware/rate-limit.js";
import { dbUsageSink, UsageBuffer } from "./middleware/usage-logger.js";

async function main() {
  const cfg = config();
  setLogLevel(cfg.LOG_LEVEL);
  assertProductionReady(cfg);

  for (const warning of configWarnings(cfg)) log.warn(warning);

  if (cfg.MIGRATE_ON_BOOT) {
    const { runMigrations } = await import("./db/migrate.js");
    await runMigrations(cfg.DATABASE_URL!);
  }

  // Imported after the config check: these modules open the database pool.
  const [{ client }, { auth }, { keysRouter }, { usageRouter }, { profileRouter, planRouter }, { accountRouter }] =
    await Promise.all([
      import("./db/client.js"),
      import("./auth/index.js"),
      import("./routes/keys.js"),
      import("./routes/usage.js"),
      import("./routes/profile.js"),
      import("./routes/account.js"),
    ]);

  const store = await createRateLimitStore(cfg.REDIS_URL);
  const resolver = new KeyResolver(dbKeyLookup, cfg.KEY_CACHE_TTL_SECONDS * 1000);
  const usage = new UsageBuffer(dbUsageSink);
  const anonymous = { perMinute: cfg.ANON_RATE_PER_MINUTE, perDay: cfg.ANON_RATE_PER_DAY };

  const app = createApp({
    config: cfg,
    resolver,
    lastUsed: new LastUsedTracker(dbTouchKey),
    limiter: new RateLimiter(store),
    usage,
    readCache: cfg.READ_CACHE_MAX_MB > 0 ? createReadCache(cfg.READ_CACHE_MAX_MB * 1024 * 1024) : undefined,
    checkDatabase: async () => {
      try {
        await client`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    },
    mountAccountRoutes: (a) => {
      a.all("/api/auth/*", async (c) => {
        try {
          return await auth.handler(c.req.raw);
        } catch (err) {
          log.error("auth handler failed", { err, id: c.get("requestId") });
          return apiError(c, 500, "AUTH_ERROR", "Sign-in failed. Please try again.");
        }
      });
      a.route(
        "/api/dashboard/keys",
        keysRouter({ maxKeysPerUser: cfg.MAX_KEYS_PER_USER, onKeyChanged: (id) => resolver.invalidateKeyId(id) })
      );
      a.route("/api/dashboard/usage", usageRouter());
      a.route("/api/dashboard/profile", profileRouter());
      a.route("/api/dashboard/plan", planRouter({ anonymous, maxKeysPerUser: cfg.MAX_KEYS_PER_USER }));
      a.route(
        "/api/dashboard/account",
        accountRouter({ onKeysRemoved: (ids) => ids.forEach((id) => resolver.invalidateKeyId(id)) })
      );
    },
  });

  const stopJobs = cfg.RUN_JOBS ? (await import("./jobs/usage-aggregation.js")).startScheduledJobs() : () => {};

  const server = serve({ fetch: app.fetch, port: cfg.PORT }, (info) => {
    log.info("gateway listening", { port: info.port, engine: cfg.BIBLE_API_URL, redis: Boolean(cfg.REDIS_URL) });
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info("shutting down", { signal });
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close();
    stopJobs();
    await usage.stop();
    await store.close?.();
    await client.end({ timeout: 5 });
    clearTimeout(force);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  log.error("gateway failed to start", { err });
  process.exit(1);
});
