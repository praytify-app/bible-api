import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brotliDecompressSync } from "node:zlib";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { hashApiKey } from "../src/lib/api-keys.js";
import { KeyResolver, LastUsedTracker, type ResolvedKey } from "../src/middleware/api-key.js";
import { createReadCache } from "../src/middleware/proxy.js";
import { MemoryStore, RateLimiter } from "../src/middleware/rate-limit.js";
import { UsageBuffer, type UsageEntry } from "../src/middleware/usage-logger.js";

const SECRET = "pb_sk_" + "s".repeat(43);
const PUBLISHABLE = "pb_pk_" + "p".repeat(43);
const EXPIRED = "pb_sk_" + "e".repeat(43);
const REVOKED = "pb_sk_" + "r".repeat(43);
const MASTER = "m".repeat(40);

const KEYS: Record<string, ResolvedKey> = {
  [hashApiKey(SECRET)]: { id: "k-secret", userId: "u1", kind: "secret", tier: "free", allowedOrigins: [], expiresAt: null, revoked: false },
  [hashApiKey(PUBLISHABLE)]: {
    id: "k-pub",
    userId: "u1",
    kind: "publishable",
    tier: "free",
    allowedOrigins: ["https://church.example"],
    expiresAt: null,
    revoked: false,
  },
  [hashApiKey(EXPIRED)]: { id: "k-exp", userId: "u1", kind: "secret", tier: "free", allowedOrigins: [], expiresAt: new Date(1000), revoked: false },
  [hashApiKey(REVOKED)]: { id: "k-rev", userId: "u1", kind: "secret", tier: "free", allowedOrigins: [], expiresAt: null, revoked: true },
};

const CHAPTER = { data: Array.from({ length: 40 }, (_, i) => ({ id: i, number: i + 1, text: "For God so loved the world ".repeat(3) })) };

interface EngineCall {
  url: URL;
  headers: Headers;
}

function setup(overrides: Record<string, string> = {}, opts: { lookupFails?: boolean } = {}) {
  const config = loadConfig({
    NODE_ENV: "test",
    BIBLE_API_URL: "http://engine.test",
    GATEWAY_TOKEN: "gateway-token-0123456789",
    MASTER_API_KEY: MASTER,
    TRUST_PROXY_HOPS: "1",
    ANON_RATE_PER_MINUTE: "5",
    PORTAL_URL: "https://praytify.bible",
    ...overrides,
  });
  const usageRows: UsageEntry[] = [];
  const usage = new UsageBuffer(async (rows) => void usageRows.push(...rows), 1000, 0);
  const lookup = vi.fn(async (hash: string) => {
    if (opts.lookupFails) throw new Error("db down");
    return KEYS[hash] ?? null;
  });
  const app = createApp({
    config,
    resolver: new KeyResolver(lookup, 60_000),
    lastUsed: new LastUsedTracker(async () => {}),
    limiter: new RateLimiter(new MemoryStore()),
    usage,
    readCache: createReadCache(10 * 1024 * 1024),
    checkDatabase: async () => true,
  });
  return { app, usage, usageRows, lookup };
}

let engineCalls: EngineCall[];
let engine: (url: URL) => Response | Promise<Response>;

beforeEach(() => {
  engineCalls = [];
  engine = (url) => {
    if (url.pathname.endsWith("/download")) return new Response(JSON.stringify({ data: { books: [] } }), { headers: { "content-type": "application/json" } });
    if (url.pathname === "/api/v1/openapi.json") {
      return Response.json({
        openapi: "3.0.0",
        info: { title: "engine", version: "1.5.0" },
        paths: {
          "/api/v1/versions": { get: { summary: "List versions" } },
          "/api/v1/search": { get: { summary: "Search" } },
          "/api/v1/versions/{id}/download": { get: { summary: "Download" } },
          "/api/v1/admin/stats": { get: { summary: "Admin" } },
        },
      });
    }
    return new Response(JSON.stringify(CHAPTER), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
    });
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      engineCalls.push({ url, headers: new Headers(init?.headers) });
      return engine(url);
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

const CHAPTER_PATH = "/v1/chapters/WEB/JHN/3/verses";

describe("public reads", () => {
  it("serves anonymously, rewrites to the engine path, and caches", async () => {
    const { app } = setup();
    const first = await app.request(CHAPTER_PATH);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(engineCalls[0]!.url.pathname).toBe("/api/v1/chapters/WEB/JHN/3/verses");

    const second = await app.request(CHAPTER_PATH);
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.json()).toEqual(CHAPTER);
    expect(engineCalls).toHaveLength(1);
  });

  it("coalesces concurrent misses into one engine request", async () => {
    const { app } = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const base = engine;
    engine = async (url) => {
      await gate;
      return base(url);
    };
    const pending = Promise.all([app.request(CHAPTER_PATH), app.request(CHAPTER_PATH), app.request(CHAPTER_PATH)]);
    await new Promise((r) => setTimeout(r, 10));
    release();
    const results = await pending;
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(engineCalls).toHaveLength(1);
  });

  it("treats reordered query strings as the same cache entry", async () => {
    const { app } = setup();
    await app.request("/v1/versions?limit=10&language=eng");
    const r = await app.request("/v1/versions?language=eng&limit=10");
    expect(r.headers.get("x-cache")).toBe("HIT");
  });

  it("answers If-None-Match with 304", async () => {
    const { app } = setup();
    const etag = (await app.request(CHAPTER_PATH)).headers.get("etag");
    expect(etag).toMatch(/^"/);
    const r = await app.request(CHAPTER_PATH, { headers: { "if-none-match": etag! } });
    expect(r.status).toBe(304);
    expect(await r.text()).toBe("");
  });

  it("compresses with brotli when the client accepts it", async () => {
    const { app } = setup();
    const r = await app.request(CHAPTER_PATH, { headers: { "accept-encoding": "gzip, br" } });
    expect(r.headers.get("content-encoding")).toBe("br");
    const json = JSON.parse(brotliDecompressSync(Buffer.from(await r.arrayBuffer())).toString());
    expect(json).toEqual(CHAPTER);
    expect(r.headers.get("vary")).toBe("Accept-Encoding");
  });

  it("serves a stale copy when the engine is down after the entry expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { app } = setup({ READ_CACHE_TTL_SECONDS: "60" });
      await app.request(CHAPTER_PATH);
      vi.setSystemTime(Date.now() + 120_000);
      engine = () => {
        throw new TypeError("fetch failed");
      };
      const r = await app.request(CHAPTER_PATH);
      expect(r.status).toBe(200);
      expect(r.headers.get("x-cache")).toBe("STALE");
      expect(await r.json()).toEqual(CHAPTER);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 502 when the engine is down and nothing is cached", async () => {
    const { app } = setup();
    engine = () => {
      throw new TypeError("fetch failed");
    };
    const r = await app.request(CHAPTER_PATH);
    expect(r.status).toBe(502);
    expect((await r.json()).error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("returns 504 on an engine timeout", async () => {
    const { app } = setup();
    engine = () => {
      throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
    };
    const r = await app.request(CHAPTER_PATH);
    expect(r.status).toBe(504);
  });

  it("forwards one trusted client IP and the gateway token, never the client's chain or key", async () => {
    const { app } = setup();
    await app.request("/v1/daily", {
      headers: { "x-forwarded-for": "6.6.6.6, 203.0.113.9", authorization: `Bearer ${SECRET}` },
    });
    const h = engineCalls[0]!.headers;
    expect(h.get("x-forwarded-for")).toBe("203.0.113.9");
    expect(h.get("x-gateway-token")).toBe("gateway-token-0123456789");
    expect(h.get("authorization")).toBeNull();
  });

  it("rate limits anonymous callers per IP with Retry-After", async () => {
    const { app } = setup();
    const from = (ip: string) => ({ headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < 5; i++) expect((await app.request(CHAPTER_PATH, from("198.51.100.1"))).status).toBe(200);
    const blocked = await app.request(CHAPTER_PATH, from("198.51.100.1"));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
    expect((await app.request(CHAPTER_PATH, from("198.51.100.2"))).status).toBe(200);
  });

  it("puts keyed callers on their account quota instead of the IP limit", async () => {
    const { app, usage, usageRows } = setup();
    const ip = { "x-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < 8; i++) {
      const r = await app.request(CHAPTER_PATH, { headers: { ...ip, authorization: `Bearer ${SECRET}` } });
      expect(r.status).toBe(200);
    }
    await usage.flush();
    expect(usageRows).toHaveLength(8);
    expect(usageRows[0]).toMatchObject({ apiKeyId: "k-secret", userId: "u1", ipAddress: "198.51.100.1" });
  });
});

describe("keyed routes and key kinds", () => {
  it("requires a key for search", async () => {
    const { app } = setup();
    const r = await app.request("/v1/search?q=love");
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("API_KEY_REQUIRED");
  });

  it("accepts a secret key and marks keyed responses private", async () => {
    const { app } = setup();
    const r = await app.request("/v1/search?q=love", { headers: { authorization: `Bearer ${SECRET}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toMatch(/^private/);
    expect(r.headers.get("x-ratelimit-limit")).toBeTruthy();
  });

  it.each([
    [EXPIRED, 401, "API_KEY_EXPIRED"],
    [REVOKED, 401, "INVALID_API_KEY"],
    ["pb_sk_unknownunknownunknown", 401, "INVALID_API_KEY"],
  ])("rejects %s", async (key, status, code) => {
    const { app } = setup();
    const r = await app.request("/v1/search?q=love", { headers: { authorization: `Bearer ${key}` } });
    expect(r.status).toBe(status);
    expect((await r.json()).error.code).toBe(code);
  });

  it("reports a key-store outage as 503, not as a bad key", async () => {
    const { app } = setup({}, { lookupFails: true });
    const r = await app.request("/v1/search?q=love", { headers: { authorization: `Bearer ${SECRET}` } });
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("AUTH_UNAVAILABLE");
  });

  it("allows a publishable key only from an allowed origin", async () => {
    const { app } = setup();
    const ok = await app.request("/v1/search?q=love", {
      headers: { authorization: `Bearer ${PUBLISHABLE}`, origin: "https://church.example" },
    });
    expect(ok.status).toBe(200);
    const wrong = await app.request("/v1/search?q=love", {
      headers: { authorization: `Bearer ${PUBLISHABLE}`, origin: "https://evil.example" },
    });
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).error.code).toBe("ORIGIN_NOT_ALLOWED");
    const server = await app.request("/v1/search?q=love", { headers: { authorization: `Bearer ${PUBLISHABLE}` } });
    expect(server.status).toBe(403);
  });

  it("refuses downloads with a publishable key", async () => {
    const { app } = setup();
    const r = await app.request("/v1/versions/WEB/download", {
      headers: { authorization: `Bearer ${PUBLISHABLE}`, origin: "https://church.example" },
    });
    expect(r.status).toBe(403);
    expect((await r.json()).error.code).toBe("SECRET_KEY_REQUIRED");
  });

  it("streams downloads without caching them", async () => {
    const { app } = setup();
    const r = await app.request("/v1/versions/WEB/download", { headers: { authorization: `Bearer ${SECRET}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get("x-cache")).toBe("BYPASS");
  });

  it("lets the master key through without rate limiting, in constant time", async () => {
    const { app } = setup({ ANON_RATE_PER_MINUTE: "1" });
    for (let i = 0; i < 5; i++) {
      const r = await app.request("/v1/search?q=x", { headers: { authorization: `Bearer ${MASTER}` } });
      expect(r.status).toBe(200);
    }
  });

  it("rejects malformed Authorization headers", async () => {
    const { app } = setup();
    const r = await app.request(CHAPTER_PATH, { headers: { authorization: "Token abc" } });
    expect(r.status).toBe(401);
    expect((await r.json()).error.code).toBe("INVALID_AUTHORIZATION");
  });
});

describe("hardening", () => {
  it("refuses writes to the read-only Bible API", async () => {
    const { app } = setup();
    const r = await app.request("/v1/versions", { method: "POST", body: "{}" });
    expect(r.status).toBe(405);
    expect(engineCalls).toHaveLength(0);
  });

  it("sets security headers on API responses", async () => {
    const { app } = setup();
    const r = await app.request(CHAPTER_PATH);
    expect(r.headers.get("strict-transport-security")).toContain("max-age=");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(r.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(r.headers.get("x-request-id")).toBeTruthy();
  });

  it("answers a CORS preflight with a fixed header list, even for a huge request-headers value", async () => {
    const { app } = setup();
    const start = performance.now();
    const r = await app.request(CHAPTER_PATH, {
      method: "OPTIONS",
      headers: {
        origin: "https://anywhere.example",
        "access-control-request-method": "GET",
        "access-control-request-headers": "x" + " ".repeat(16_000) + "y",
      },
    });
    expect(performance.now() - start).toBeLessThan(200);
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-headers")).toBe("Authorization,If-None-Match,Accept,Accept-Language");
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("uses the error envelope for unknown routes", async () => {
    const { app } = setup();
    const r = await app.request("/nope");
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });

  it("reports readiness from the database probe", async () => {
    const { app } = setup();
    expect((await app.request("/health/ready")).status).toBe(200);
  });
});

describe("public API reference", () => {
  it("publishes the engine spec under /v1 with keyed routes marked and admin hidden", async () => {
    const { app } = setup({ PUBLIC_API_URL: "https://api.praytify.bible" });
    const spec = await (await app.request("/v1/openapi.json")).json();
    expect(Object.keys(spec.paths).sort()).toEqual(["/v1/search", "/v1/versions", "/v1/versions/{id}/download"]);
    expect(spec.servers[0].url).toBe("https://api.praytify.bible");
    expect(spec.paths["/v1/search"].get.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths["/v1/versions"].get.security).toEqual([{}, { bearerAuth: [] }]);
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });

  it("serves the docs page with a CSP that allows only the pinned CDN script and framing by the portal", async () => {
    const { app } = setup();
    const r = await app.request("/docs");
    const csp = r.headers.get("content-security-policy")!;
    expect(csp).toContain("script-src https://cdn.jsdelivr.net");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'self' https://praytify.bible");
    expect(r.headers.get("x-frame-options")).toBeNull();
    expect(await r.text()).toContain('integrity="sha384-');
  });
});
