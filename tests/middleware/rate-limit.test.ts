import { describe, expect, it } from "vitest";
import { MemoryStore, RateLimiter, rateLimitHeaders } from "../../src/middleware/rate-limit.js";

const LIMITS = { perMinute: 3, perDay: 5 };
const T0 = Date.UTC(2026, 9, 14, 12, 0, 0);

describe("RateLimiter with MemoryStore", () => {
  it("allows up to the minute limit and then blocks", async () => {
    const rl = new RateLimiter(new MemoryStore());
    for (let i = 0; i < 3; i++) expect((await rl.check("u:1", LIMITS, T0 + i)).allowed).toBe(true);
    const blocked = await rl.check("u:1", LIMITS, T0 + 10);
    expect(blocked).toMatchObject({ allowed: false, window: "minute", remaining: 0, limit: 3 });
  });

  it("opens again in the next minute window", async () => {
    const rl = new RateLimiter(new MemoryStore());
    for (let i = 0; i < 4; i++) await rl.check("u:1", LIMITS, T0);
    expect((await rl.check("u:1", LIMITS, T0 + 60_000)).allowed).toBe(true);
  });

  it("does not charge minute-blocked requests to the day window", async () => {
    const rl = new RateLimiter(new MemoryStore());
    // 10 requests in one minute: 3 allowed, 7 blocked by the minute limit.
    for (let i = 0; i < 10; i++) await rl.check("u:1", LIMITS, T0);
    // Next minute: day budget is 5, only 3 used, so 2 more are allowed.
    expect((await rl.check("u:1", LIMITS, T0 + 60_000)).allowed).toBe(true);
    expect((await rl.check("u:1", LIMITS, T0 + 60_001)).allowed).toBe(true);
    expect(await rl.check("u:1", LIMITS, T0 + 60_002)).toMatchObject({ allowed: false, window: "day" });
  });

  it("keeps scopes independent", async () => {
    const rl = new RateLimiter(new MemoryStore());
    for (let i = 0; i < 3; i++) await rl.check("u:1", LIMITS, T0);
    expect((await rl.check("u:2", LIMITS, T0)).allowed).toBe(true);
  });

  it("reports the window closest to exhaustion", async () => {
    const rl = new RateLimiter(new MemoryStore());
    const r = await rl.check("u:1", { perMinute: 100, perDay: 2 }, T0);
    expect(r).toMatchObject({ window: "day", remaining: 1, limit: 2 });
  });

  it("sweeps expired windows so memory tracks active clients", async () => {
    const store = new MemoryStore(1_000_000);
    await store.incr("a", 1000, T0);
    await store.incr("b", 5000, T0);
    store.sweep(T0 + 2000);
    expect(store.size).toBe(1);
    await store.close();
  });
});

describe("rateLimitHeaders", () => {
  it("adds Retry-After only when blocked", () => {
    const ok = rateLimitHeaders({ allowed: true, limit: 60, remaining: 59, resetAt: T0 + 30_000, window: "minute" }, T0);
    expect(ok["Retry-After"]).toBeUndefined();
    expect(ok["X-RateLimit-Remaining"]).toBe("59");
    const blocked = rateLimitHeaders({ allowed: false, limit: 60, remaining: 0, resetAt: T0 + 30_000, window: "minute" }, T0);
    expect(blocked["Retry-After"]).toBe("30");
    expect(blocked["RateLimit-Policy"]).toBe("60;w=60");
  });
});
