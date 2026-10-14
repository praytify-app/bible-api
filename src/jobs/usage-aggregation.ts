import { client } from "../db/client.js";
import { log } from "../lib/logger.js";

// Only one replica runs a job at a time; the others skip that tick.
const AGGREGATION_LOCK_ID = 726_310_010;
const PURGE_LOCK_ID = 726_310_011;

async function withJobLock(lockId: number, name: string, work: (tx: typeof client) => Promise<void>): Promise<void> {
  try {
    await client.begin(async (tx) => {
      const [{ locked }] = await tx`SELECT pg_try_advisory_xact_lock(${lockId}) AS locked`;
      if (!locked) return;
      await work(tx as unknown as typeof client);
    });
  } catch (err) {
    log.error(`job ${name} failed`, { err });
  }
}

/**
 * Recompute yesterday and today (UTC) from the raw log. Recomputing yesterday
 * catches requests logged after the last run before midnight, which a
 * today-only rollup silently dropped. The range predicate uses the
 * created_at index instead of scanning every row through DATE().
 */
export function aggregateUsage(): Promise<void> {
  return withJobLock(AGGREGATION_LOCK_ID, "usage-aggregation", async (tx) => {
    await tx`
      INSERT INTO platform.usage_daily (api_key_id, user_id, date, request_count, error_count, avg_response_time_ms)
      SELECT api_key_id,
             user_id,
             to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
             COUNT(*)::int,
             (COUNT(*) FILTER (WHERE status_code >= 400))::int,
             AVG(response_time_ms)::int
      FROM platform.usage_logs
      WHERE created_at >= ((date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day') AT TIME ZONE 'UTC')
      GROUP BY api_key_id, user_id, 3
      ON CONFLICT (api_key_id, date) DO UPDATE SET
        request_count = EXCLUDED.request_count,
        error_count = EXCLUDED.error_count,
        avg_response_time_ms = EXCLUDED.avg_response_time_ms,
        updated_at = NOW()
    `;
    log.debug("usage aggregation complete");
  });
}

export function purgeOldLogs(): Promise<void> {
  return withJobLock(PURGE_LOCK_ID, "usage-purge", async (tx) => {
    const rows = await tx`DELETE FROM platform.usage_logs WHERE created_at < NOW() - INTERVAL '90 days'`;
    log.info("old usage logs purged", { rows: rows.count });
  });
}

export function startScheduledJobs(): () => void {
  const agg = setInterval(() => void aggregateUsage(), 10 * 60 * 1000);
  const purge = setInterval(() => void purgeOldLogs(), 24 * 60 * 60 * 1000);
  agg.unref();
  purge.unref();
  void aggregateUsage();
  log.info("scheduled jobs started", { aggregationEveryMin: 10, purgeEveryHours: 24 });
  return () => {
    clearInterval(agg);
    clearInterval(purge);
  };
}
