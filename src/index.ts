import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

import { apiKeyMiddleware } from "./middleware/api-key.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { usageLoggerMiddleware } from "./middleware/usage-logger.js";
import { proxyToBibleApi } from "./middleware/proxy.js";

const app = new Hono();

// --- CORS ---
// Restrictive CORS for auth/dashboard routes
app.use(
  "/api/auth/*",
  cors({
    origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(
  "/api/dashboard/*",
  cors({
    origin: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Open CORS for API routes (public Bible API)
app.use("/v1/*", cors());

// --- Health Check ---
app.get("/health", async (c) => {
  let dbStatus = "unknown";
  try {
    const { client } = await import("./db/client.js");
    await client`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }

  return c.json({
    status: "ok",
    service: "praytify-bible-gateway",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// --- Unauthenticated Proxy Routes ---
// OpenAPI spec and docs are public
app.get("/v1/openapi.json", proxyToBibleApi);
app.get("/docs", proxyToBibleApi);
app.get("/docs/*", proxyToBibleApi);

// --- BetterAuth Routes ---
// Lazy-load to avoid import errors when DB isn't available
app.all("/api/auth/*", async (c) => {
  const { authRouter } = await import("./routes/auth.js");
  // Re-dispatch to the auth router
  return authRouter.fetch(c.req.raw, c.env);
});

// --- Dashboard API Routes ---
app.all("/api/dashboard/keys/*", async (c) => {
  const { keysRouter } = await import("./routes/keys.js");
  return keysRouter.fetch(c.req.raw, c.env);
});
app.all("/api/dashboard/keys", async (c) => {
  const { keysRouter } = await import("./routes/keys.js");
  return keysRouter.fetch(c.req.raw, c.env);
});

app.all("/api/dashboard/usage/*", async (c) => {
  const { usageRouter } = await import("./routes/usage.js");
  return usageRouter.fetch(c.req.raw, c.env);
});
app.all("/api/dashboard/usage", async (c) => {
  const { usageRouter } = await import("./routes/usage.js");
  return usageRouter.fetch(c.req.raw, c.env);
});

app.all("/api/dashboard/profile/*", async (c) => {
  const { profileRouter } = await import("./routes/profile.js");
  return profileRouter.fetch(c.req.raw, c.env);
});
app.all("/api/dashboard/profile", async (c) => {
  const { profileRouter } = await import("./routes/profile.js");
  return profileRouter.fetch(c.req.raw, c.env);
});

// --- Authenticated Bible API Routes ---
// /v1/* (except openapi.json) requires API key + rate limit + usage logging
app.use("/v1/*", apiKeyMiddleware);
app.use("/v1/*", rateLimitMiddleware);
app.use("/v1/*", usageLoggerMiddleware);
app.all("/v1/*", proxyToBibleApi);

// --- Start Server ---
const port = parseInt(process.env.PORT || "3000", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`praytify-bible gateway listening on http://localhost:${info.port}`);
  }
);

export { app };
