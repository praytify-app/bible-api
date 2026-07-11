import { Hono } from "hono";
import { client } from "../db/client.js";
import { getSessionUser } from "../lib/session.js";

const usageRouter = new Hono();

/**
 * GET /api/dashboard/usage — Daily usage stats for the authenticated user.
 * Query params: ?days=30 (default 30, max 90 — matches the retention purge
 * in jobs/usage-aggregation.ts, so older rows never exist anyway)
 */
usageRouter.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const days = Math.min(
    Math.max(parseInt(c.req.query("days") || "30", 10) || 30, 1),
    90
  );
  const from = new Date(Date.now() - (days - 1) * 86_400_000)
    .toISOString()
    .split("T")[0];
  const to = new Date().toISOString().split("T")[0];

  const rows = await client`
    SELECT date,
           SUM(request_count)::int AS requests,
           SUM(error_count)::int AS errors,
           CASE WHEN SUM(request_count) > 0
                THEN (SUM(avg_response_time_ms * request_count) / SUM(request_count))::int
                ELSE 0 END AS avg_response_time_ms
    FROM platform.usage_daily
    WHERE user_id = ${user.id} AND date >= ${from}
    GROUP BY date
    ORDER BY date ASC
  `;

  return c.json({
    period: { days, from, to },
    daily: rows.map((r: any) => ({
      date: r.date,
      requests: r.requests,
      errors: r.errors,
      avgResponseTimeMs: r.avg_response_time_ms,
    })),
  });
});

/**
 * GET /api/dashboard/usage/summary — Aggregated usage for the authenticated user.
 * Today's requests come from usage_logs because the hourly rollup job lags
 * behind real time; totals come from the usage_daily rollups.
 */
usageRouter.get("/summary", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const [totals] = await client`
    SELECT COALESCE(SUM(request_count), 0)::int AS total_requests,
           COALESCE(SUM(error_count), 0)::int AS total_errors,
           CASE WHEN SUM(request_count) > 0
                THEN (SUM(avg_response_time_ms * request_count) / SUM(request_count))::int
                ELSE 0 END AS avg_response_time_ms
    FROM platform.usage_daily
    WHERE user_id = ${user.id}
  `;

  const [today] = await client`
    SELECT COUNT(*)::int AS requests_today
    FROM platform.usage_logs
    WHERE user_id = ${user.id} AND created_at >= CURRENT_DATE
  `;

  const [keys] = await client`
    SELECT COUNT(*)::int AS active_keys
    FROM platform.api_keys
    WHERE user_id = ${user.id} AND revoked = false
  `;

  return c.json({
    summary: {
      totalRequests: totals.total_requests,
      totalErrors: totals.total_errors,
      avgResponseTimeMs: totals.avg_response_time_ms,
      requestsToday: today.requests_today,
      activeKeys: keys.active_keys,
    },
  });
});

export { usageRouter };
