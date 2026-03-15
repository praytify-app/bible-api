import type { Context, Next } from "hono";

/**
 * Async fire-and-forget usage logging middleware.
 * Logs request metadata to the usage_logs table after the response is sent.
 *
 * DB insertion is deferred and non-blocking — failures are logged but
 * do not affect the API response.
 */
export async function usageLoggerMiddleware(c: Context, next: Next) {
  const startTime = Date.now();

  await next();

  const responseTimeMs = Date.now() - startTime;
  const apiKeyId = (c.get("apiKeyId") as string) || "unknown";
  const userId = (c.get("userId") as string) || "unknown";

  // Fire-and-forget: log usage asynchronously
  logUsage({
    apiKeyId,
    userId,
    method: c.req.method,
    path: c.req.path,
    statusCode: c.res.status,
    responseTimeMs,
    userAgent: c.req.header("User-Agent") || null,
    ipAddress:
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
      c.req.header("X-Real-IP") ||
      null,
  }).catch((err) => {
    console.error("[usage-logger] Failed to log usage:", err);
  });
}

interface UsageLogEntry {
  apiKeyId: string;
  userId: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  userAgent: string | null;
  ipAddress: string | null;
}

/**
 * Insert a usage log entry into the database.
 * Lazy-imports the DB client to avoid import-time errors when DB is unavailable.
 */
async function logUsage(entry: UsageLogEntry): Promise<void> {
  try {
    const { db } = await import("../db/client.js");
    const { usageLogs } = await import("../db/schema.js");

    await db.insert(usageLogs).values({
      apiKeyId: entry.apiKeyId,
      userId: entry.userId,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      responseTimeMs: entry.responseTimeMs,
      userAgent: entry.userAgent,
      ipAddress: entry.ipAddress,
    });
  } catch {
    // Silently fail — usage logging should never break API responses
  }
}
