import { Hono } from "hono";
import { z } from "zod";
import { client } from "../db/client.js";
import { apiError } from "../lib/errors.js";
import type { DashboardEnv } from "../lib/session.js";
import { requireSession } from "../lib/session.js";

// Matches the 90-day retention purge in jobs/usage-aggregation.ts.
const MAX_DAYS = 90;

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(MAX_DAYS).catch(30),
  keyId: z.uuid().optional(),
});

function utcDate(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export function usageRouter() {
  const router = new Hono<DashboardEnv>();
  router.use("*", requireSession);

  /** Daily totals in UTC. Days with no traffic are omitted; the portal zero-fills them. */
  router.get("/", async (c) => {
    const user = c.get("user");
    const q = querySchema.safeParse(c.req.query());
    if (!q.success) return apiError(c, 400, "INVALID_REQUEST", "keyId must be a key id.");
    const { days, keyId } = q.data;
    const from = utcDate(days - 1);
    const to = utcDate(0);

    const rows = await client`
      SELECT date,
             SUM(request_count)::int AS requests,
             SUM(error_count)::int AS errors,
             CASE WHEN SUM(request_count) > 0
                  THEN (SUM(avg_response_time_ms::bigint * request_count) / SUM(request_count))::int
                  ELSE 0 END AS avg_response_time_ms
      FROM platform.usage_daily
      WHERE user_id = ${user.id} AND date >= ${from}
        ${keyId ? client`AND api_key_id = ${keyId}` : client``}
      GROUP BY date
      ORDER BY date ASC
    `;

    return c.json({
      period: { days, from, to },
      daily: rows.map((r) => ({
        date: r.date,
        requests: r.requests,
        errors: r.errors,
        avgResponseTimeMs: r.avg_response_time_ms,
      })),
    });
  });

  router.get("/summary", async (c) => {
    const user = c.get("user");
    const { days } = querySchema.parse(c.req.query());
    const from = utcDate(days - 1);

    const [[totals], [today], [keys]] = await Promise.all([
      client`
        SELECT COALESCE(SUM(request_count), 0)::int AS total_requests,
               COALESCE(SUM(error_count), 0)::int AS total_errors,
               CASE WHEN SUM(request_count) > 0
                    THEN (SUM(avg_response_time_ms::bigint * request_count) / SUM(request_count))::int
                    ELSE 0 END AS avg_response_time_ms
        FROM platform.usage_daily
        WHERE user_id = ${user.id} AND date >= ${from}
      `,
      // The rollup lags real time, so today's count reads the raw log.
      // Midnight is UTC regardless of the database server's time zone.
      client`
        SELECT COUNT(*)::int AS requests_today
        FROM platform.usage_logs
        WHERE user_id = ${user.id}
          AND created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
      `,
      client`
        SELECT COUNT(*)::int AS active_keys
        FROM platform.api_keys
        WHERE user_id = ${user.id} AND revoked = false AND (expires_at IS NULL OR expires_at > NOW())
      `,
    ]);

    return c.json({
      summary: {
        periodDays: days,
        totalRequests: totals!.total_requests,
        totalErrors: totals!.total_errors,
        avgResponseTimeMs: totals!.avg_response_time_ms,
        requestsToday: today!.requests_today,
        activeKeys: keys!.active_keys,
      },
    });
  });

  /** Requests per key over the period, including keys that have since been revoked. */
  router.get("/keys", async (c) => {
    const user = c.get("user");
    const { days } = querySchema.parse(c.req.query());
    const from = utcDate(days - 1);
    const rows = await client`
      SELECT d.api_key_id AS key_id, k.name, k.kind, k.revoked,
             SUM(d.request_count)::int AS requests, SUM(d.error_count)::int AS errors
      FROM platform.usage_daily d
      LEFT JOIN platform.api_keys k ON k.id::text = d.api_key_id
      WHERE d.user_id = ${user.id} AND d.date >= ${from}
      GROUP BY d.api_key_id, k.name, k.kind, k.revoked
      ORDER BY requests DESC
    `;
    return c.json({
      period: { days, from, to: utcDate(0) },
      keys: rows.map((r) => ({
        keyId: r.key_id,
        name: r.name ?? "Deleted key",
        kind: r.kind ?? "secret",
        revoked: r.revoked ?? true,
        requests: r.requests,
        errors: r.errors,
      })),
    });
  });

  return router;
}
