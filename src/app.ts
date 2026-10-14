import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import type { Config } from "./config.js";
import { apiError } from "./lib/errors.js";
import { log } from "./lib/logger.js";
import type { LruCache } from "./lib/lru.js";
import { apiKeyAuth, KeyResolver, LastUsedTracker } from "./middleware/api-key.js";
import type { StoredResponse } from "./middleware/proxy.js";
import { createProxy } from "./middleware/proxy.js";
import type { RateLimiter } from "./middleware/rate-limit.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import type { UsageBuffer } from "./middleware/usage-logger.js";
import { usageLogger } from "./middleware/usage-logger.js";
import { docsRouter } from "./routes/docs.js";
import type { GatewayEnv } from "./types.js";

export interface AppDeps {
  config: Config;
  resolver: KeyResolver;
  lastUsed: LastUsedTracker;
  limiter: RateLimiter;
  usage: UsageBuffer;
  readCache?: LruCache<StoredResponse>;
  /** Database liveness probe; injected so tests need no database. */
  checkDatabase: () => Promise<boolean>;
  /** Mounts /api/auth and /api/dashboard. Optional so proxy-only tests skip BetterAuth. */
  mountAccountRoutes?: (app: Hono<GatewayEnv>) => void;
}

/** Public read routes: anyone can call them; a key upgrades the caller to their account quota. */
const PUBLIC_READ_ROUTES = [
  "/v1/languages",
  "/v1/languages/:code",
  "/v1/versions",
  "/v1/versions/:id",
  "/v1/versions/:id/books",
  "/v1/books/:id/chapters",
  "/v1/chapters/:id/verses",
  "/v1/chapters/:version/:bookCode/:chapter/verses",
  "/v1/verses",
  "/v1/verses/:id",
  "/v1/daily",
];

/** Routes that require a key. */
const KEYED_ROUTES = ["/v1/search", "/v1/versions/:id/download"];

export function createApp(deps: AppDeps): Hono<GatewayEnv> {
  const cfg = deps.config;
  const app = new Hono<GatewayEnv>();
  const anonymousLimits = { perMinute: cfg.ANON_RATE_PER_MINUTE, perDay: cfg.ANON_RATE_PER_DAY };

  app.use("*", requestId({ headerName: "X-Request-Id" }));

  // Access log, one line per request. Health probes are skipped: they fire
  // every few seconds and would drown everything else.
  app.use("*", async (c, next) => {
    const start = performance.now();
    await next();
    if (c.req.path.startsWith("/health")) return;
    const auth = c.get("auth");
    log.info("request", {
      id: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
      auth: auth?.type,
      key: auth?.type === "key" ? auth.keyId : undefined,
      cache: c.get("cacheStatus"),
    });
  });

  const sharedHeaders = {
    strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
    referrerPolicy: "no-referrer",
    crossOriginOpenerPolicy: "same-origin",
    removePoweredBy: true,
  } as const;
  // JSON API: nothing here should ever render as a page or be framed.
  const apiHeaders = secureHeaders({
    ...sharedHeaders,
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
    xFrameOptions: "DENY",
    // Scripture is meant to be fetched from other sites.
    crossOriginResourcePolicy: "cross-origin",
  });
  // The API reference page loads Scalar from a pinned, integrity-checked CDN
  // file and is embedded by the portal, so it gets its own policy.
  const docsHeaders = secureHeaders({
    ...sharedHeaders,
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      scriptSrc: ["https://cdn.jsdelivr.net"],
      styleSrc: ["https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["https://cdn.jsdelivr.net", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'self'", ...cfg.PORTAL_URL],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
    xFrameOptions: false,
    crossOriginResourcePolicy: "same-site",
  });
  app.use("*", (c, next) => (c.req.path === "/docs" ? docsHeaders(c, next) : apiHeaders(c, next)));

  app.use("*", compress());

  // --- CORS ---------------------------------------------------------------
  const portalCors = cors({
    origin: cfg.PORTAL_URL,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 600,
  });
  app.use("/api/auth/*", portalCors);
  app.use("/api/dashboard/*", portalCors);

  // Any site may read scripture. Explicit allowHeaders: reflecting the
  // request's header list is where hono's CORS ReDoS lived.
  app.use(
    "/v1/*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS"],
      allowHeaders: ["Authorization", "If-None-Match", "Accept", "Accept-Language"],
      exposeHeaders: [
        "ETag",
        "Retry-After",
        "X-Request-Id",
        "X-Cache",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
        "RateLimit-Policy",
      ],
      maxAge: 86_400,
    })
  );

  // Dashboard and auth bodies are small JSON; nothing else accepts a body.
  app.use("/api/*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => apiError(c, 413, "PAYLOAD_TOO_LARGE", "Request body too large.") }));

  // --- Health -------------------------------------------------------------
  // Liveness never fails on a database outage, so the container is not
  // restart-looped; readiness does, and is what monitoring should watch.
  app.get("/health", async (c) => {
    const dbUp = await deps.checkDatabase();
    return c.json({
      status: dbUp ? "ok" : "degraded",
      service: "praytify-bible-gateway",
      database: dbUp ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    });
  });
  app.get("/health/ready", async (c) => {
    const dbUp = await deps.checkDatabase();
    return c.json({ ready: dbUp, database: dbUp ? "connected" : "disconnected" }, dbUp ? 200 : 503);
  });

  // --- Public docs --------------------------------------------------------
  app.route(
    "/",
    docsRouter({
      engineUrl: cfg.BIBLE_API_URL,
      publicUrl: cfg.PUBLIC_API_URL ?? cfg.BETTER_AUTH_URL,
      gatewayToken: cfg.GATEWAY_TOKEN,
    })
  );

  // --- Account routes (BetterAuth + dashboard) ------------------------------
  deps.mountAccountRoutes?.(app);

  // --- Bible API ------------------------------------------------------------
  const proxyBase = {
    upstream: cfg.BIBLE_API_URL,
    gatewayToken: cfg.GATEWAY_TOKEN,
    timeoutMs: cfg.UPSTREAM_TIMEOUT_MS,
    downloadTimeoutMs: cfg.DOWNLOAD_TIMEOUT_MS,
    cache: deps.readCache,
    maxFreshMs: cfg.READ_CACHE_TTL_SECONDS * 1000,
    staleIfErrorMs: 24 * 60 * 60 * 1000,
    maxEntryBytes: cfg.READ_CACHE_MAX_ENTRY_KB * 1024,
  };
  const publicProxy = createProxy({ ...proxyBase, privateResponses: false });
  const keyedProxy = createProxy({ ...proxyBase, privateResponses: true });

  const authBase = {
    resolver: deps.resolver,
    lastUsed: deps.lastUsed,
    masterKey: cfg.MASTER_API_KEY,
    trustedHops: cfg.TRUST_PROXY_HOPS,
  };
  const optionalKey = apiKeyAuth({ ...authBase, required: false });
  const requiredKey = apiKeyAuth({ ...authBase, required: true });
  const limit = rateLimitMiddleware(deps.limiter, anonymousLimits);
  const logUsage = usageLogger(deps.usage);

  // The engine's surface is read-only; refuse other methods before any work.
  app.on(["POST", "PUT", "PATCH", "DELETE"], "/v1/*", (c) =>
    apiError(c, 405, "METHOD_NOT_ALLOWED", "The Bible API is read-only.", { Allow: "GET, HEAD, OPTIONS" })
  );

  for (const path of KEYED_ROUTES) {
    app.on(["GET", "HEAD"], path, requiredKey, limit, logUsage, keyedProxy);
  }
  for (const path of PUBLIC_READ_ROUTES) {
    app.on(["GET", "HEAD"], path, optionalKey, limit, logUsage, publicProxy);
  }

  app.notFound((c) => apiError(c, 404, "NOT_FOUND", `No route for ${c.req.method} ${c.req.path}. See /docs.`));

  app.onError((err, c) => {
    log.error("unhandled error", { err, id: c.get("requestId"), path: c.req.path });
    return apiError(c, 500, "INTERNAL_ERROR", `Something went wrong. Reference: ${c.get("requestId") ?? "n/a"}`);
  });

  return app;
}
