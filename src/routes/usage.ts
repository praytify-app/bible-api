import { Hono } from "hono";

const usageRouter = new Hono();

/**
 * GET /api/dashboard/usage — Get daily usage stats for the authenticated user.
 * Query params: ?days=30 (default 30)
 */
usageRouter.get("/", async (c) => {
  const days = parseInt(c.req.query("days") || "30", 10);

  // TODO: Validate session via BetterAuth
  // TODO: Query usage_daily from database

  return c.json({
    period: {
      days,
      from: new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0],
      to: new Date().toISOString().split("T")[0],
    },
    daily: [],
    message: "Usage stats require database connection",
  });
});

/**
 * GET /api/dashboard/usage/summary — Get aggregated usage summary.
 */
usageRouter.get("/summary", async (c) => {
  // TODO: Validate session via BetterAuth
  // TODO: Aggregate from usage_daily

  return c.json({
    summary: {
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTimeMs: 0,
      activeKeys: 0,
    },
    message: "Usage summary requires database connection",
  });
});

export { usageRouter };
