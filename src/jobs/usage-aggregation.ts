import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

export async function aggregateUsage() {
  try {
    await db.execute(sql`
      INSERT INTO platform.usage_daily (api_key_id, date, request_count, error_count, avg_latency_ms)
      SELECT
          api_key_id,
          DATE(logged_at) AS date,
          COUNT(*) AS request_count,
          COUNT(*) FILTER (WHERE status_code >= 400) AS error_count,
          AVG(response_ms)::INTEGER AS avg_latency_ms
      FROM platform.usage_logs
      WHERE DATE(logged_at) = CURRENT_DATE
      GROUP BY api_key_id, DATE(logged_at)
      ON CONFLICT (api_key_id, date) DO UPDATE SET
          request_count = EXCLUDED.request_count,
          error_count = EXCLUDED.error_count,
          avg_latency_ms = EXCLUDED.avg_latency_ms
    `);
    console.log("[job] Usage aggregation complete");
  } catch (err) {
    console.error("[job] Usage aggregation failed:", err);
  }
}

export async function purgeOldLogs() {
  try {
    await db.execute(sql`
      DELETE FROM platform.usage_logs
      WHERE logged_at < NOW() - INTERVAL '90 days'
    `);
    console.log("[job] Old logs purged");
  } catch (err) {
    console.error("[job] Log purge failed:", err);
  }
}

export function startScheduledJobs() {
  setInterval(aggregateUsage, 60 * 60 * 1000); // hourly
  setInterval(purgeOldLogs, 24 * 60 * 60 * 1000); // daily
  aggregateUsage(); // run immediately on startup
  console.log("[jobs] Scheduled usage aggregation (hourly) and log purge (daily)");
}
