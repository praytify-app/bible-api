import type { Context, Next } from "hono";
import { log } from "../lib/logger.js";
import type { GatewayEnv } from "../types.js";

export interface UsageEntry {
  apiKeyId: string;
  userId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

/**
 * Buffers usage rows and writes them as one multi-row insert, instead of one
 * insert per request. Flushes on size, on a timer, and on shutdown; a hard
 * crash can lose at most one interval of rows, acceptable for dashboard
 * metrics (see ADR 0002).
 */
export class UsageBuffer {
  private rows: UsageEntry[] = [];
  private timer: NodeJS.Timeout | undefined;
  private flushing: Promise<void> = Promise.resolve();

  constructor(
    private readonly sink: (rows: UsageEntry[]) => Promise<void>,
    private readonly maxBatch = 500,
    intervalMs = 2_000,
    private readonly maxBuffered = 50_000
  ) {
    if (intervalMs > 0) {
      this.timer = setInterval(() => void this.flush(), intervalMs);
      this.timer.unref();
    }
  }

  push(entry: UsageEntry): void {
    // If the database is down for a long time, drop the oldest rows rather
    // than grow without bound.
    if (this.rows.length >= this.maxBuffered) this.rows.shift();
    this.rows.push(entry);
    if (this.rows.length >= this.maxBatch) void this.flush();
  }

  flush(): Promise<void> {
    this.flushing = this.flushing.then(async () => {
      while (this.rows.length) {
        const batch = this.rows.splice(0, this.maxBatch);
        try {
          await this.sink(batch);
        } catch (err) {
          log.warn("usage flush failed; rows requeued", { err, rows: batch.length });
          this.rows.unshift(...batch);
          return;
        }
      }
    });
    return this.flushing;
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  get pending(): number {
    return this.rows.length;
  }
}

export async function dbUsageSink(rows: UsageEntry[]): Promise<void> {
  const { client } = await import("../db/client.js");
  await client`
    INSERT INTO platform.usage_logs ${client(
      rows.map((r) => ({
        api_key_id: r.apiKeyId,
        user_id: r.userId,
        method: r.method,
        path: r.path.slice(0, 500),
        status_code: r.statusCode,
        response_time_ms: r.responseTimeMs,
        user_agent: r.userAgent?.slice(0, 300) ?? null,
        ip_address: r.ipAddress?.slice(0, 45) ?? null,
        created_at: r.createdAt,
      }))
    )}
  `;
}

/** Records keyed and master-key requests. Anonymous traffic is not logged per request. */
export function usageLogger(buffer: UsageBuffer) {
  return async (c: Context<GatewayEnv>, next: Next) => {
    const start = performance.now();
    await next();
    const auth = c.get("auth");
    if (!auth || auth.type === "anonymous") return;
    buffer.push({
      apiKeyId: auth.type === "key" ? auth.keyId : "master",
      userId: auth.type === "key" ? auth.userId : "internal",
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      responseTimeMs: Math.round(performance.now() - start),
      userAgent: c.req.header("user-agent") ?? null,
      ipAddress: auth.ip,
      createdAt: new Date(),
    });
  };
}
