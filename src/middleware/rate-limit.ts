import type { Context, Next } from "hono";

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Max requests per day per key */
  perDay: number;
  /** Max requests per minute per key */
  perMinute: number;
}

/**
 * In-memory rate limiter with per-key day and minute windows.
 * Suitable for single-process deployments. For multi-process,
 * replace with Redis-backed implementation.
 */
export class RateLimiter {
  private perDay: number;
  private perMinute: number;
  private dayWindows = new Map<string, RateLimitWindow>();
  private minuteWindows = new Map<string, RateLimitWindow>();

  constructor(options: RateLimiterOptions) {
    this.perDay = options.perDay;
    this.perMinute = options.perMinute;
  }

  /**
   * Check and consume a request for the given key.
   * Returns rate limit info including whether the request is allowed.
   */
  check(key: string, now: number = Date.now()): RateLimitResult {
    // Check minute window first (more restrictive short-term)
    const minuteResult = this.checkWindow(
      this.minuteWindows,
      `min:${key}`,
      this.perMinute,
      60_000,
      now
    );

    if (!minuteResult.allowed) {
      return minuteResult;
    }

    // Check day window
    const dayResult = this.checkWindow(
      this.dayWindows,
      `day:${key}`,
      this.perDay,
      86_400_000,
      now
    );

    if (!dayResult.allowed) {
      return dayResult;
    }

    // Both passed — consume from both windows
    this.consume(this.minuteWindows, `min:${key}`);
    this.consume(this.dayWindows, `day:${key}`);

    // Return the more restrictive remaining count
    const remaining = Math.min(minuteResult.remaining - 1, dayResult.remaining - 1);
    const resetAt = Math.min(minuteResult.resetAt, dayResult.resetAt);

    return {
      allowed: true,
      limit: Math.min(this.perMinute, this.perDay),
      remaining: Math.max(0, remaining),
      resetAt,
    };
  }

  private checkWindow(
    windows: Map<string, RateLimitWindow>,
    windowKey: string,
    limit: number,
    durationMs: number,
    now: number
  ): RateLimitResult {
    const window = windows.get(windowKey);

    if (!window || now >= window.resetAt) {
      // Window expired or doesn't exist — create new one
      const resetAt = now + durationMs;
      windows.set(windowKey, { count: 0, resetAt });
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt,
      };
    }

    if (window.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: window.resetAt,
      };
    }

    return {
      allowed: true,
      limit,
      remaining: limit - window.count,
      resetAt: window.resetAt,
    };
  }

  private consume(
    windows: Map<string, RateLimitWindow>,
    windowKey: string
  ): void {
    const window = windows.get(windowKey);
    if (window) {
      window.count++;
    }
  }
}

/** Default rate limiter instance: 1000/day, 60/minute */
const defaultLimiter = new RateLimiter({ perDay: 1000, perMinute: 60 });

/**
 * Hono middleware that enforces per-key rate limits.
 * Expects `apiKeyId` to be set on the context (by apiKeyMiddleware).
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const apiKeyId = c.get("apiKeyId") as string | undefined;

  // Master key is not rate-limited
  if (apiKeyId === "master") {
    await next();
    return;
  }

  if (!apiKeyId) {
    return c.json({ error: "Unauthorized", message: "API key required" }, 401);
  }

  const result = defaultLimiter.check(apiKeyId);

  c.header("X-RateLimit-Limit", String(result.limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    return c.json(
      {
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      429
    );
  }

  await next();
}
