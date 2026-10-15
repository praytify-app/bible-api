# ADR 0002: Stateless gateway with pluggable shared state and read caching

- Status: Accepted
- Date: 2026-10-14

## Context

The gateway holds rate-limit counters in process memory, so a restart resets every quota and a second replica doubles every limit. Each keyed request also costs three database round trips: a key lookup, a `last_used_at` update, and a usage-log insert. Scripture text changes only when the corpus is re-seeded, yet nothing is cached: every read of John 3 goes gateway, engine, Postgres, and back, and responses carry no `Cache-Control` or `ETag`, so neither browsers nor a CDN can help.

The platform runs as one gateway replica today. It must also be easy to self-host on a single small VPS, so any new infrastructure has to stay optional.

## Options for shared rate-limit state

1. **In-memory only (today).** Fine for one replica, wrong for two.
2. **Postgres.** No new infrastructure, but adds a write per request to the same database that serves scripture.
3. **Redis when configured, memory otherwise (chosen).** One interface, two stores. A single-node self-hoster sets nothing. A scaled deployment sets `REDIS_URL` and every replica shares counters atomically.

## Decision

- Rate limiting goes behind a `RateLimitStore` interface with a memory store (default) and a Redis store selected by `REDIS_URL`. The Redis client is loaded lazily, so it costs nothing when unused.
- API key lookups are cached in process for 60 seconds (positive and negative), so a hot key costs zero database reads per request. Revocation takes effect within that window; the dashboard says so.
- `last_used_at` is written at most once per minute per key instead of on every request.
- Usage logs are buffered and flushed as one multi-row insert every two seconds or 500 entries, and flushed on shutdown.
- Public and keyed GET responses for scripture are cached in a byte-bounded in-process LRU, keyed by path and query only (never by credentials), after authentication and rate limiting have run. Responses carry `Cache-Control` with `stale-while-revalidate` and a strong `ETag`, and the gateway answers `If-None-Match` with 304.
- Responses are compressed (gzip or brotli as negotiated).

## Consequences

- A corpus re-seed is visible after at most the cache TTL (one hour by default, `READ_CACHE_TTL_SECONDS`). Operators can restart the gateway to flush immediately.
- The process cache is per replica, so N replicas warm N caches. That is the right trade at this scale; a shared CDN in front of `api.praytify.bible` is the next step and the cache headers make it a configuration change, not a code change.
- Buffered usage logs can lose up to two seconds of entries on a hard crash. Usage data is for dashboards and quotas, not billing, so that loss is acceptable.
