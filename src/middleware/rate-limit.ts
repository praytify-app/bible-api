import type { Context, Next } from "hono";
import type { Limits } from "../plans.js";
import { limitsFor, publishableClientLimits } from "../plans.js";
import { apiError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import type { GatewayEnv } from "../types.js";

/** A fixed-window counter: increment `key` and report the new count and when the window ends. */
export interface RateLimitStore {
  incr(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: number }>;
  close?(): Promise<void>;
}

/** Single-process store. Correct for one replica; counters reset on restart. */
export class MemoryStore implements RateLimitStore {
  private windows = new Map<string, { count: number; resetAt: number }>();
  private sweeper: NodeJS.Timeout;

  constructor(sweepEveryMs = 60_000) {
    // Expired windows are dropped on a timer so memory tracks active clients,
    // not every client ever seen.
    this.sweeper = setInterval(() => this.sweep(Date.now()), sweepEveryMs);
    this.sweeper.unref();
  }

  async incr(key: string, windowMs: number, now: number) {
    let w = this.windows.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, w);
    }
    w.count++;
    return { count: w.count, resetAt: w.resetAt };
  }

  sweep(now: number): void {
    for (const [k, w] of this.windows) if (w.resetAt <= now) this.windows.delete(k);
  }

  get size(): number {
    return this.windows.size;
  }

  async close(): Promise<void> {
    clearInterval(this.sweeper);
  }
}

// INCR and set the expiry atomically on the first hit, so a crash between the
// two commands can never leave a counter that never expires.
const INCR_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {c, redis.call('PTTL', KEYS[1])}
`;

interface MinimalRedis {
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
  quit?(): Promise<unknown>;
  close?(): Promise<unknown>;
}

/** Shared store for multiple gateway replicas. */
export class RedisStore implements RateLimitStore {
  constructor(private readonly redis: MinimalRedis) {}

  async incr(key: string, windowMs: number, now: number) {
    const res = (await this.redis.eval(INCR_SCRIPT, { keys: [key], arguments: [String(windowMs)] })) as [number, number];
    const ttl = Number(res[1]);
    return { count: Number(res[0]), resetAt: now + (ttl > 0 ? ttl : windowMs) };
  }

  async close(): Promise<void> {
    await (this.redis.close?.() ?? this.redis.quit?.());
  }
}

export async function createRateLimitStore(redisUrl?: string): Promise<RateLimitStore> {
  if (!redisUrl) return new MemoryStore();
  const { createClient } = await import("redis");
  const client = createClient({ url: redisUrl });
  client.on("error", (err: unknown) => log.error("redis error", { err }));
  await client.connect();
  log.info("rate limits use redis");
  return new RedisStore(client as unknown as MinimalRedis);
}

/**
 * The bucket an anonymous client is counted in. IPv4 addresses count alone.
 * An IPv6 client usually controls a whole /64 and can rotate through it at
 * will, so IPv6 is counted per /64 prefix; otherwise one host could
 * multiply the anonymous limit by changing addresses.
 */
export function anonymousBucket(ip: string | null): string {
  if (!ip) return "unknown";
  const addr = ip.replace(/^\[|\]$/g, "").replace(/%.*$/, "").toLowerCase();
  if (addr.startsWith("::ffff:") && addr.includes(".")) return addr.slice(7); // IPv4-mapped
  if (!addr.includes(":")) return addr;
  const [head = "", tail = ""] = addr.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = addr.includes("::") ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
  if (groups.length !== 8) return addr;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  window: "minute" | "day";
}

const MINUTE = 60_000;
const DAY = 86_400_000;

export class RateLimiter {
  constructor(private readonly store: RateLimitStore) {}

  /**
   * Charge one request to `scope` against both windows. The minute window is
   * checked first and a request it blocks is not charged to the day, so a burst
   * cannot burn a whole day's allowance.
   */
  async check(scope: string, limits: Limits, now = Date.now()): Promise<RateLimitResult> {
    const minuteKey = `rl:${scope}:m:${Math.floor(now / MINUTE)}`;
    const m = await this.store.incr(minuteKey, MINUTE - (now % MINUTE), now);
    if (m.count > limits.perMinute) {
      return { allowed: false, limit: limits.perMinute, remaining: 0, resetAt: m.resetAt, window: "minute" };
    }
    const dayKey = `rl:${scope}:d:${Math.floor(now / DAY)}`;
    const d = await this.store.incr(dayKey, DAY - (now % DAY), now);
    if (d.count > limits.perDay) {
      return { allowed: false, limit: limits.perDay, remaining: 0, resetAt: d.resetAt, window: "day" };
    }
    // Report whichever window is closer to exhaustion.
    const minuteLeft = limits.perMinute - m.count;
    const dayLeft = limits.perDay - d.count;
    return minuteLeft <= dayLeft
      ? { allowed: true, limit: limits.perMinute, remaining: minuteLeft, resetAt: m.resetAt, window: "minute" }
      : { allowed: true, limit: limits.perDay, remaining: dayLeft, resetAt: d.resetAt, window: "day" };
  }
}

export function rateLimitHeaders(r: RateLimitResult, now = Date.now()): Record<string, string> {
  const resetSec = Math.max(0, Math.ceil((r.resetAt - now) / 1000));
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(Math.max(0, r.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
    "RateLimit-Policy": `${r.limit};w=${r.window === "minute" ? 60 : 86400}`,
  };
  if (!r.allowed) h["Retry-After"] = String(Math.max(1, resetSec));
  return h;
}

/**
 * Charges the request to the caller's account (keyed requests) or to the
 * client IP (anonymous requests). Master-key traffic is exempt. A publishable
 * key is also charged to the client's share of its account budget
 * (`publishableClientLimits`), checked first so a client past its share is
 * refused without spending what the site's other visitors rely on.
 */
export function rateLimitMiddleware(limiter: RateLimiter, anonymous: Limits) {
  return async (c: Context<GatewayEnv>, next: Next) => {
    const auth = c.get("auth");
    if (!auth || auth.type === "master") return next();

    const scope = auth.type === "key" ? `u:${auth.userId}:${auth.kind}` : `ip:${anonymousBucket(auth.ip)}`;
    const limits = auth.type === "key" ? limitsFor(auth.tier, auth.kind) : anonymous;
    const perClient = auth.type === "key" && auth.kind === "publishable";

    let result: RateLimitResult;
    let clientCapped = false;
    try {
      if (perClient) {
        const client = await limiter.check(`${scope}:ip:${anonymousBucket(auth.ip)}`, publishableClientLimits(limits));
        if (client.allowed) {
          result = await limiter.check(scope, limits);
          // Report whichever budget runs out first, as check() does for its windows.
          if (result.allowed && client.remaining < result.remaining) result = client;
        } else {
          result = client;
          clientCapped = true;
        }
      } else {
        result = await limiter.check(scope, limits);
      }
    } catch (err) {
      // Fail open: a cache outage must not take scripture offline. Logged at
      // error so it pages whoever watches the logs.
      log.error("rate limiter unavailable, allowing request", { err, scope });
      return next();
    }

    const headers = rateLimitHeaders(result);
    if (!result.allowed) {
      const hint =
        auth.type === "anonymous"
          ? "Send an API key to get a per-account quota instead of the shared per-IP one."
          : clientCapped
            ? `One client may use ${result.limit} requests per ${result.window} of this publishable key's shared allowance.`
            : `Your ${auth.tier} plan allows ${result.limit} requests per ${result.window}.`;
      return apiError(c, 429, "RATE_LIMITED", `Rate limit exceeded. ${hint}`, headers);
    }
    await next();
    for (const [k, v] of Object.entries(headers)) c.res.headers.set(k, v);
  };
}
