import { describe, expect, it, vi } from "vitest";
import {
  displayPrefix,
  extractBearer,
  generateApiKey,
  hashApiKey,
  normalizeOriginPattern,
  originAllowed,
  requestOrigin,
  safeEqual,
} from "../../src/lib/api-keys.js";
import { KeyResolver, LastUsedTracker, type ResolvedKey } from "../../src/middleware/api-key.js";

describe("extractBearer", () => {
  it("accepts a well-formed bearer token", () => {
    expect(extractBearer("Bearer pb_sk_abcDEF123_-")).toBe("pb_sk_abcDEF123_-");
  });
  it.each([undefined, "", "Bearer", "Bearer ", "Basic abc12345", "bearer pb_sk_abcdefgh", "Bearer a b", "Bearer short"])(
    "rejects %j",
    (h) => expect(extractBearer(h)).toBeNull()
  );
  it("rejects absurdly long tokens instead of hashing them", () => {
    expect(extractBearer("Bearer " + "a".repeat(10_000))).toBeNull();
  });
});

describe("key material", () => {
  it("prefixes keys by kind and never repeats", () => {
    const a = generateApiKey("secret");
    const b = generateApiKey("publishable");
    expect(a.startsWith("pb_sk_")).toBe(true);
    expect(b.startsWith("pb_pk_")).toBe(true);
    expect(a).not.toBe(generateApiKey("secret"));
    expect(a.length).toBeGreaterThanOrEqual(48);
  });
  it("hashes deterministically and shows only a short prefix", () => {
    const k = generateApiKey("secret");
    expect(hashApiKey(k)).toBe(hashApiKey(k));
    expect(hashApiKey(k)).toMatch(/^[0-9a-f]{64}$/);
    expect(displayPrefix(k)).toHaveLength(13);
  });
  it("compares in constant time and still distinguishes lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("origin allowlists", () => {
  it.each([
    ["https://Example.org/", "https://example.org"],
    ["https://example.org:443", "https://example.org"],
    ["https://*.example.org", "https://*.example.org"],
    ["http://localhost:5173", "http://localhost:5173"],
    ["http://localhost:*", "http://localhost:*"],
  ])("normalises %s", (input, expected) => {
    expect(normalizeOriginPattern(input)).toEqual({ pattern: expected });
  });

  it.each(["*", "", "example.org", "https://example.org/path", "ftp://example.org", "https://*.com", "https://ex*ample.org", "https://example.org:*", "https://user@example.org"])(
    "rejects %j",
    (input) => expect(normalizeOriginPattern(input)).toHaveProperty("error")
  );

  const patterns = ["https://example.org", "https://*.church.org", "http://localhost:*"];
  it.each([
    ["https://example.org", true],
    ["https://example.org:443", true],
    ["http://example.org", false],
    ["https://evil-example.org", false],
    ["https://example.org.evil.com", false],
    ["https://a.church.org", true],
    ["https://a.b.church.org", true],
    ["https://church.org", false],
    ["https://notchurch.org", false],
    ["http://localhost:3000", true],
    ["https://localhost:3000", false],
    [null, false],
    ["not a url", false],
  ])("origin %s allowed=%s", (origin, expected) => {
    expect(originAllowed(origin as string | null, patterns)).toBe(expected);
  });

  it("falls back to the Referer origin and ignores the literal 'null' origin", () => {
    expect(requestOrigin({ origin: "null", referer: "https://example.org/page?x=1" })).toBe("https://example.org");
    expect(requestOrigin({ origin: "https://a.org", referer: "https://b.org/" })).toBe("https://a.org");
    expect(requestOrigin({})).toBeNull();
  });
});

const KEY: ResolvedKey = {
  id: "k1",
  userId: "u1",
  kind: "secret",
  tier: "free",
  allowedOrigins: [],
  expiresAt: null,
  revoked: false,
};

describe("KeyResolver", () => {
  it("caches hits so a hot key costs one lookup", async () => {
    const lookup = vi.fn(async () => KEY);
    const r = new KeyResolver(lookup, 60_000);
    await r.resolve("h");
    await r.resolve("h");
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("caches misses briefly", async () => {
    const lookup = vi.fn(async () => null);
    const r = new KeyResolver(lookup, 60_000, 10_000);
    expect(await r.resolve("bad")).toBeNull();
    expect(await r.resolve("bad")).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("drops a key immediately when invalidated by id", async () => {
    const lookup = vi.fn(async () => KEY);
    const r = new KeyResolver(lookup, 60_000);
    await r.resolve("h");
    r.invalidateKeyId("k1");
    await r.resolve("h");
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("does not cache at all with a zero TTL", async () => {
    const lookup = vi.fn(async () => KEY);
    const r = new KeyResolver(lookup, 0, 0);
    await r.resolve("h");
    await r.resolve("h");
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});

describe("LastUsedTracker", () => {
  it("writes at most once per interval per key", () => {
    const write = vi.fn(async () => {});
    const t = new LastUsedTracker(write, 60_000);
    t.touch("k1", 0);
    t.touch("k1", 30_000);
    t.touch("k2", 30_000);
    t.touch("k1", 61_000);
    expect(write.mock.calls).toEqual([["k1"], ["k2"], ["k1"]]);
  });
});
