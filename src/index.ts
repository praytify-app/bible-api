import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { apiKeyMiddleware } from "./middleware/api-key.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { usageLoggerMiddleware } from "./middleware/usage-logger.js";
import { proxyToBibleApi } from "./middleware/proxy.js";
import { startScheduledJobs } from "./jobs/usage-aggregation.js";
import { keysRouter } from "./routes/keys.js";
import { usageRouter } from "./routes/usage.js";
import { profileRouter } from "./routes/profile.js";

const app = new Hono();

// --- CORS ---
// Restrictive CORS for auth/dashboard routes (portal origin)
app.use(
  "/api/auth/*",
  cors({
    origin: process.env.PORTAL_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(
  "/api/dashboard/*",
  cors({
    origin: process.env.PORTAL_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Open CORS for API routes (public Bible API)
app.use("/v1/*", cors());

// --- Health Checks ---
async function checkDatabase(): Promise<boolean> {
  try {
    const { client } = await import("./db/client.js");
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

// Liveness: always 200 so the container isn't restart-looped over a DB
// outage, but status/database reflect reality for anyone looking.
app.get("/health", async (c) => {
  const dbUp = await checkDatabase();
  return c.json({
    status: dbUp ? "ok" : "degraded",
    service: "praytify-bible-gateway",
    database: dbUp ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Readiness: 503 when the platform can't serve its core function.
// Point uptime monitoring here: a green /health with a dead DB is how
// the July 2026 outage went unnoticed.
app.get("/health/ready", async (c) => {
  const dbUp = await checkDatabase();
  return c.json(
    { ready: dbUp, database: dbUp ? "connected" : "disconnected" },
    dbUp ? 200 : 503
  );
});

// --- Unauthenticated Proxy Routes ---
// OpenAPI spec and docs are public
app.get("/v1/openapi.json", proxyToBibleApi);
app.get("/docs", proxyToBibleApi);
app.get("/docs/*", proxyToBibleApi);

// Catalog metadata (which translations/languages exist) is public: it powers
// the portal's translation browser and lets anyone evaluate the corpus before
// signing up. Scripture content itself stays behind API keys. These routes
// skip the gateway key/rate-limit chain; the engine's own IP rate limiter
// still applies upstream.
app.get("/v1/versions", proxyToBibleApi);
app.get("/v1/languages", proxyToBibleApi);

// --- BetterAuth Routes ---
// Forward directly to BetterAuth handler
app.all("/api/auth/*", async (c) => {
  try {
    const { auth } = await import("./auth/index.js");
    const response = await auth.handler(c.req.raw);
    return response;
  } catch (err) {
    console.error("[auth] Error handling auth request:", err);
    return c.json({ error: "Internal auth error", details: String(err) }, 500);
  }
});

// --- Dashboard API Routes ---
// Mounted with app.route() so sub-router paths resolve correctly
app.route("/api/dashboard/keys", keysRouter);
app.route("/api/dashboard/usage", usageRouter);
app.route("/api/dashboard/profile", profileRouter);

// --- Authenticated Bible API Routes ---
// /v1/* (except openapi.json) requires API key + rate limit + usage logging
app.use("/v1/*", apiKeyMiddleware);
app.use("/v1/*", rateLimitMiddleware);
app.use("/v1/*", usageLoggerMiddleware);
app.all("/v1/*", proxyToBibleApi);

// --- Start Server ---
const port = parseInt(process.env.PORT || "3200", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`praytify-bible gateway listening on http://localhost:${info.port}`);
    startScheduledJobs();
  }
);

export { app };
