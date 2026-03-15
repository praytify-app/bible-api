import { describe, it, expect } from "vitest";
import { RateLimiter } from "../../src/middleware/rate-limit.js";

describe("RateLimiter", () => {
  it("allows requests under limit", () => {
    const limiter = new RateLimiter({ perDay: 100, perMinute: 10 });
    const result = limiter.check("key-1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("blocks when per-minute limit is exceeded", () => {
    const limiter = new RateLimiter({ perDay: 1000, perMinute: 3 });
    const now = Date.now();

    // Consume 3 requests (the limit)
    limiter.check("key-1", now);
    limiter.check("key-1", now);
    limiter.check("key-1", now);

    // 4th should be blocked
    const result = limiter.check("key-1", now);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("blocks when per-day limit is exceeded", () => {
    const limiter = new RateLimiter({ perDay: 3, perMinute: 100 });
    const now = Date.now();

    limiter.check("key-1", now);
    limiter.check("key-1", now);
    limiter.check("key-1", now);

    const result = limiter.check("key-1", now);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks keys independently", () => {
    const limiter = new RateLimiter({ perDay: 1000, perMinute: 2 });
    const now = Date.now();

    // Exhaust key-1
    limiter.check("key-1", now);
    limiter.check("key-1", now);
    const blocked = limiter.check("key-1", now);
    expect(blocked.allowed).toBe(false);

    // key-2 should still be allowed
    const result = limiter.check("key-2", now);
    expect(result.allowed).toBe(true);
  });

  it("returns limit, remaining, and resetAt", () => {
    const limiter = new RateLimiter({ perDay: 1000, perMinute: 10 });
    const now = Date.now();
    const result = limiter.check("key-1", now);

    expect(result.limit).toBeDefined();
    expect(typeof result.limit).toBe("number");
    expect(result.remaining).toBeDefined();
    expect(typeof result.remaining).toBe("number");
    expect(result.resetAt).toBeDefined();
    expect(result.resetAt).toBeGreaterThan(now);
  });

  it("resets after window expires", () => {
    const limiter = new RateLimiter({ perDay: 1000, perMinute: 2 });
    const now = Date.now();

    // Exhaust minute limit
    limiter.check("key-1", now);
    limiter.check("key-1", now);
    expect(limiter.check("key-1", now).allowed).toBe(false);

    // Advance past minute window
    const future = now + 61_000;
    const result = limiter.check("key-1", future);
    expect(result.allowed).toBe(true);
  });
});
