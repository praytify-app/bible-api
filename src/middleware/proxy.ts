import type { Context } from "hono";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";
import { apiError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { LruCache } from "../lib/lru.js";
import type { GatewayEnv } from "../types.js";

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** A fully buffered upstream response, shareable between concurrent requests and the cache. */
export interface StoredResponse {
  status: number;
  body: Uint8Array;
  contentType: string;
  etag: string | null;
  cacheControl: string | null;
  /** Lazily filled compressed variants, so each entry is compressed at most once per encoding. */
  encodings: { br?: Uint8Array; gzip?: Uint8Array };
  freshUntil: number;
}

export function createReadCache(maxBytes: number): LruCache<StoredResponse> {
  // Charged at insert time, before compressed variants exist, so reserve room
  // for them up front: brotli plus gzip of JSON text is typically under 60%.
  return new LruCache<StoredResponse>(maxBytes, (r) => Math.ceil(r.body.byteLength * 1.6) + 512);
}

export interface ProxyOptions {
  upstream: string;
  gatewayToken?: string;
  timeoutMs: number;
  downloadTimeoutMs: number;
  cache?: LruCache<StoredResponse>;
  /** Upper bound on freshness, whatever the engine says. */
  maxFreshMs: number;
  /** How long an expired entry is kept to serve if the engine is down. */
  staleIfErrorMs: number;
  maxEntryBytes: number;
  /** Responses for routes that need a key must never be stored by shared caches. */
  privateResponses: boolean;
}

const BUFFER_LIMIT = 16 * 1024 * 1024;
const COMPRESS_MIN_BYTES = 1024;

class UpstreamError extends Error {
  constructor(readonly kind: "timeout" | "network" | "too_large", cause?: unknown) {
    super(kind, { cause });
  }
}

/** Path plus query with parameters sorted, so `?a=1&b=2` and `?b=2&a=1` share a cache entry. */
export function cacheKeyFor(url: URL): string {
  const params = [...url.searchParams.entries()].sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const qs = new URLSearchParams(params).toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

function upstreamUrl(base: string, url: URL): string {
  // The engine serves the public /v1 surface under /api/v1.
  const path = url.pathname === "/v1" || url.pathname.startsWith("/v1/") ? `/api${url.pathname}` : url.pathname;
  return `${base}${path}${url.search}`;
}

function maxAgeMs(cacheControl: string | null): number | null {
  if (!cacheControl) return null;
  if (/\b(no-store|private|no-cache)\b/i.test(cacheControl)) return 0;
  const s = /s-maxage=(\d+)/i.exec(cacheControl) ?? /max-age=(\d+)/i.exec(cacheControl);
  return s ? Number(s[1]) * 1000 : null;
}

function strongEtag(body: Uint8Array): string {
  return `"${createHash("sha256").update(body).digest("base64url").slice(0, 32)}"`;
}

function etagMatches(ifNoneMatch: string | undefined, etag: string | null): boolean {
  if (!ifNoneMatch || !etag) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return ifNoneMatch.split(",").some((t) => t.trim().replace(/^W\//, "") === bare);
}

function pickEncoding(acceptEncoding: string | undefined): "br" | "gzip" | null {
  if (!acceptEncoding) return null;
  const ae = acceptEncoding.toLowerCase();
  if (/\bbr\b(?!;q=0(\.0*)?\b)/.test(ae)) return "br";
  if (/\bgzip\b(?!;q=0(\.0*)?\b)/.test(ae)) return "gzip";
  return null;
}

/**
 * Brotli window bits for a body: the smallest window that holds all of it
 * (a window is 2^bits - 16 bytes), so the output does not change. The default
 * 22-bit window is a 4 MB buffer allocated and freed on every call; for
 * chapter-sized bodies that setup cost more than the compression itself.
 * Sizing it cut brotli CPU per cache miss 2.4 to 4 times (docs/PERFORMANCE.md).
 */
export function brotliWindowBits(byteLength: number): number {
  const { BROTLI_MIN_WINDOW_BITS, BROTLI_DEFAULT_WINDOW } = zlibConstants;
  const needed = Math.ceil(Math.log2(byteLength + 16));
  return Math.min(BROTLI_DEFAULT_WINDOW, Math.max(BROTLI_MIN_WINDOW_BITS, needed));
}

async function encode(entry: StoredResponse, enc: "br" | "gzip"): Promise<Uint8Array> {
  const existing = entry.encodings[enc];
  if (existing) return existing;
  const out =
    enc === "br"
      ? await brotli(entry.body, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
            [zlibConstants.BROTLI_PARAM_LGWIN]: brotliWindowBits(entry.body.byteLength),
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: entry.body.byteLength,
          },
        })
      : await gzipAsync(entry.body, { level: 6 });
  const bytes = new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  entry.encodings[enc] = bytes;
  return bytes;
}

function forwardHeaders(c: Context<GatewayEnv>, token?: string): Headers {
  const h = new Headers();
  h.set("accept", "application/json");
  h.set("accept-encoding", "identity");
  const lang = c.req.header("accept-language");
  if (lang) h.set("accept-language", lang);
  const auth = c.get("auth");
  // One trustworthy address, never the client-supplied chain.
  if (auth?.ip) h.set("x-forwarded-for", auth.ip);
  const rid = c.get("requestId");
  if (rid) h.set("x-request-id", rid);
  if (token) h.set("x-gateway-token", token);
  h.set("user-agent", "praytify-bible-gateway");
  return h;
}

async function fetchUpstream(url: string, headers: Headers, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    throw new UpstreamError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", err);
  }
}

async function readBounded(res: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await res.body?.cancel();
    throw new UpstreamError("too_large");
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > limit) throw new UpstreamError("too_large");
  return buf;
}

export function createProxy(opts: ProxyOptions) {
  const inflight = new Map<string, Promise<StoredResponse>>();

  async function load(c: Context<GatewayEnv>, url: URL): Promise<StoredResponse> {
    const res = await fetchUpstream(upstreamUrl(opts.upstream, url), forwardHeaders(c, opts.gatewayToken), opts.timeoutMs);
    const body = await readBounded(res, BUFFER_LIMIT);
    const cacheControl = res.headers.get("cache-control");
    const etag = res.headers.get("etag") ?? (res.status === 200 ? strongEtag(body) : null);
    const upstreamMax = maxAgeMs(cacheControl);
    const freshMs = res.status === 200 ? Math.min(opts.maxFreshMs, upstreamMax ?? opts.maxFreshMs) : 0;
    return {
      status: res.status,
      body,
      contentType: res.headers.get("content-type") ?? "application/json; charset=utf-8",
      etag,
      cacheControl,
      encodings: {},
      freshUntil: Date.now() + freshMs,
    };
  }

  function clientCacheControl(entry: StoredResponse): string {
    if (entry.status !== 200) return "no-store";
    if (opts.privateResponses) return "private, max-age=300";
    return entry.cacheControl && !/\bprivate\b/i.test(entry.cacheControl)
      ? entry.cacheControl
      : "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
  }

  async function serve(c: Context<GatewayEnv>, entry: StoredResponse, status: string): Promise<Response> {
    c.set("cacheStatus", status as GatewayEnv["Variables"]["cacheStatus"]);
    const headers: Record<string, string> = {
      "content-type": entry.contentType,
      "cache-control": clientCacheControl(entry),
      vary: "Accept-Encoding",
      "x-cache": status,
    };
    if (entry.etag) headers.etag = entry.etag;

    if (entry.status === 200 && etagMatches(c.req.header("if-none-match"), entry.etag)) {
      return new Response(null, { status: 304, headers });
    }

    let body: Uint8Array = entry.body;
    const enc = entry.body.byteLength >= COMPRESS_MIN_BYTES ? pickEncoding(c.req.header("accept-encoding")) : null;
    if (enc) {
      body = await encode(entry, enc);
      headers["content-encoding"] = enc;
    }
    headers["content-length"] = String(body.byteLength);
    return new Response(c.req.method === "HEAD" ? null : (body as Uint8Array<ArrayBuffer>), { status: entry.status, headers });
  }

  function upstreamFailure(c: Context<GatewayEnv>, err: unknown): Response {
    if (err instanceof UpstreamError && err.kind === "timeout") {
      return apiError(c, 504, "UPSTREAM_TIMEOUT", "The Bible engine took too long to respond. Please retry.");
    }
    if (err instanceof UpstreamError && err.kind === "too_large") {
      return apiError(c, 502, "UPSTREAM_TOO_LARGE", "The upstream response was larger than the gateway allows.");
    }
    log.error("upstream request failed", { err, path: c.req.path });
    return apiError(c, 502, "UPSTREAM_UNAVAILABLE", "The Bible engine is unavailable. Please retry shortly.");
  }

  /** Large responses (full-Bible download) are streamed, never buffered or cached. */
  async function stream(c: Context<GatewayEnv>, url: URL): Promise<Response> {
    const headers = forwardHeaders(c, opts.gatewayToken);
    const inm = c.req.header("if-none-match");
    if (inm) headers.set("if-none-match", inm);
    let res: Response;
    try {
      res = await fetchUpstream(upstreamUrl(opts.upstream, url), headers, opts.downloadTimeoutMs);
    } catch (err) {
      return upstreamFailure(c, err);
    }
    const out = new Headers();
    // retry-after carries the engine's download bulkhead hint on a 503.
    for (const h of ["content-type", "content-length", "etag", "last-modified", "content-disposition", "retry-after"]) {
      const v = res.headers.get(h);
      if (v) out.set(h, v);
    }
    out.set("cache-control", res.ok ? (opts.privateResponses ? "private, max-age=3600" : res.headers.get("cache-control") ?? "public, max-age=3600") : "no-store");
    out.set("x-cache", "BYPASS");
    return new Response(c.req.method === "HEAD" ? null : res.body, { status: res.status, headers: out });
  }

  return async function proxy(c: Context<GatewayEnv>): Promise<Response> {
    const url = new URL(c.req.url);
    if (/\/download\/?$/.test(url.pathname)) return stream(c, url);

    const key = cacheKeyFor(url);
    const cached = opts.cache?.get(key);
    if (cached && cached.freshUntil > Date.now()) return serve(c, cached, "HIT");

    let pending = inflight.get(key);
    if (!pending) {
      pending = load(c, url).finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }

    let entry: StoredResponse;
    try {
      entry = await pending;
    } catch (err) {
      if (cached) {
        log.warn("serving stale response; engine unavailable", { path: url.pathname });
        return serve(c, cached, "STALE");
      }
      return upstreamFailure(c, err);
    }

    if (entry.status >= 500 && cached) return serve(c, cached, "STALE");

    if (opts.cache && entry.status === 200 && entry.freshUntil > Date.now() && entry.body.byteLength <= opts.maxEntryBytes) {
      const keepMs = entry.freshUntil - Date.now() + opts.staleIfErrorMs;
      opts.cache.set(key, entry, keepMs);
    }
    return serve(c, entry, opts.cache ? "MISS" : "BYPASS");
  };
}
