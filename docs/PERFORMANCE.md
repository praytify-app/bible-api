# Performance at production scale

- Date: 2026-10-14
- Scope: the gateway (this repo) and the engine (`open-bible-api`), both on `feat/platform-hardening`, against a restore of the production corpus
- Related: [ADR 0002](adr/0002-stateless-gateway-and-read-caching.md), [GAP-EVAL Dimension 6](GAP-EVAL-2026-10-14.md#dimension-6-performance-and-scalability)

## Summary

- **Reads are healthy.** Every chapter, passage, book, and daily-verse query uses an index and runs in under a millisecond warm, 4 to 16 ms on average under cold-cache load. No sequential scan touches `verses` on the read path. The first bottleneck is Node CPU, not Postgres.
- **The gateway cache does its job for hot content.** Popular chapters served from cache ran at about 1,000 requests a second at p95 90 ms, five times the engine's throughput for the same chapters at a fifth of the latency.
- **Search was the real problem, and it got worse as more translations were vectorized.** "lord" in KJV took 2 s with 7 versions vectorized and 12 s with 30; common words on the trigram path hit the 15 s timeout; a two-character Chinese query across six versions took 40 s. Fixed in the engine: under mixed load, search went from 3 to 4 requests a second with 19 to 26% errors to 43 to 59 a second, and the only errors left were `400`s for a query the API rejects by design.
- **Concurrent full-Bible downloads failed under load.** Four at once alongside chapter reads pushed the download query past the statement timeout (23 to 78% failed across runs) and slowed reads several times. Fixed in the engine with a download bulkhead and a longer download timeout: no failures in the same test.
- **A quarter of the gateway's main thread on cache misses went to brotli setup and teardown.** Sizing the brotli window to the body cut compression CPU 2.4 to 4 times, with output the same size or smaller.
- **Search infrastructure for the whole catalog takes about an hour on a fresh database**, most of it building the 2.4 GB trigram index. Re-running it after new imports, with the indexes in place, is much slower per translation.
- **Production Postgres runs on defaults.** `docker-compose.prod.yml` passes no settings, so the 2 GB container has a 128 MB buffer cache. Tuning is recommended below; it was not A/B tested here.

## Environment

All measurements ran on the isolated dev Docker daemon, never production.

| Item | Value |
|---|---|
| Host | Shared dev VPS: 12 vCPU, 47 GiB RAM, SSD, Docker 29.8 in a containerized daemon |
| Host load during tests | Load average 15 to 40 from other tenants, peaking at 131 during one batch |
| Postgres | `postgres:16-alpine` (16.15), 2 GB memory limit, as in production |
| Engine | 1 GB limit, `DB_POOL_MAX=20`, statement timeout 15 s (default) |
| Gateway | 768 MB limit, `DB_POOL_MAX=20`, `NODE_ENV=production`, read cache 128 MB and 1 h TTL (defaults), anonymous limits raised so they never applied, `MASTER_API_KEY` for keyed routes |
| Load generator | `grafana/k6` in the same Docker network: no TLS, no Traefik, no internet latency |
| Images, before | engine `8fa93a8`, gateway `e3599cd` |
| Images, after | engine `81cb9c9`; gateway `3abfe4f` plus unrelated account-route commits (the `Retry-After` change in `7b7b9db` is covered by tests, not by these runs) |

Postgres settings used, against what production gets today:

| Setting | Test | Production (compose passes none) |
|---|---|---|
| `shared_buffers` | 512MB | 128MB |
| `effective_cache_size` | 1536MB | 4GB |
| `work_mem` | 16MB | 4MB |
| `maintenance_work_mem` | 256MB | 64MB |
| `max_wal_size` | 4GB | 1GB |
| Extras | `pg_stat_statements`, `auto_explain` (off except while capturing plans), `track_io_timing` | none |

## Dataset

Restored from `bible-data.sql.gz` (pg_dump of July 2026), streamed over SSH into `psql` in 9 min 45 s with no errors.

| Table | Rows |
|---|---|
| languages | 1,020 |
| versions | 1,288 (all with verses) |
| books | 40,597 |
| chapters | 535,280 (1,194 have no verses) |
| verses | 14,811,699 |
| daily_verses | 366 |

The database is 4.5 GB as restored: `verses` is 4.4 GB of it, including `verses_chapter_number` (574 MB) and its primary key (317 MB). With search infrastructure for 7 versions it grows to 7.0 GB.

### What the restore needed

1. **A migration baseline for the engine.** The dump carries the schema of migrations 0000 and 0001 (the `attribution`, `license_type`, and `has_audio` columns are there) but not the `drizzle` schema, so `MIGRATE_ON_BOOT=true` fails with `relation "books" already exists`. Recording both migrations as applied fixed it:

   ```sql
   CREATE SCHEMA IF NOT EXISTS drizzle;
   CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
   INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES
     ('f42ed0e69b4156f613a96d3ae2bf2fb678127c2283bc4c1cf9bc333a658c6110', 1773514397420),
     ('3eecb714258b76b774b97396d18d3646710cb4504a8d1fc05dd153aaba658bfe', 1783742777358);
   ```

   The gateway baselines its own hand-built schema on first boot; the engine has no equivalent.
2. **Search infrastructure.** The dump has no `search_vector` column and no `pg_trgm`, so `/v1/search` cannot run against it until `search:build` has. Inference, not verified: if production still matches the July dump, search there fails.
3. **`VACUUM ANALYZE`** after the restore and after vectorizing, which production's autovacuum would do in time.

## Method

- **Query plans**: `auto_explain` (analyze, buffers) enabled for the engine's database role while real HTTP requests hit each endpoint twice, so the plans are the engine's exact SQL and parameters. Search variants were compared with `EXPLAIN (ANALYZE, BUFFERS)` and timed `PREPARE`/`EXECUTE` in `psql`.
- **Load tests**: [`scripts/perf/k6-load.js`](../scripts/perf/k6-load.js) with targets from [`scripts/perf/targets.sql`](../scripts/perf/targets.sql). Closed model, 50 virtual users for 45 s (20 for search) unless a fixed arrival rate is stated. Every scenario runs against the gateway (with its cache, restarted before each run) and the engine directly (no cache). Brotli and gzip are accepted, as a browser would.
  - hot: 20 popular chapters in WEB and KJV
  - cold: 50,000 random chapters across the whole catalog
  - refs: 20,000 `?ref=` lookups built from random verses (whole chapter, single verse, five-verse range)
  - versions: the catalog at `limit=2000`, 60% unfiltered, 25% by language, 15% by name search
  - search: 160 version and query pairs, mostly English, with seven other stemmed languages, the trigram path (Swahili, Indonesian, Tagalog, Hausa, Vietnamese, Arabic, Korean, Chinese, Hindi), and language-wide searches
  - download mix: cold reads plus four users looping full-Bible downloads of random complete translations
- **CPU profiles**: `node --cpu-prof` on a second gateway or engine container under the same load.
- **Targets exclude** the 1,194 empty chapters (the engine answers 404, correctly) and three versions whose abbreviations cannot be addressed by URL (a leading space, or a `/`).

## Query plans at scale

Warm timings from `auto_explain` on real requests:

| Query (engine source) | Time | Plan |
|---|---|---|
| Chapter: version and book lookup (`chapters.ts`) | 0.07-0.5 ms | `versions_abbreviation_unique`, `books_version_book_code` |
| Chapter: verses | 0.08-0.4 ms | `chapters_book_number`, then `verses_chapter_number` |
| `?ref=`: versions with books (`passages.ts`) | 0.1-0.5 ms; 1.1-3.3 ms for three versions | index scans |
| `?ref=`: verses | 0.08-0.3 ms | same path as chapters |
| Versions list, `limit=2000` | 19-24 ms, count 0.5-1.9 ms | sequential scan of the 1,288-row `versions` table and a sort; fine at this size |
| Versions list by language | 2.4 ms | |
| Versions list by name search | 6-13 ms | `ILIKE` over 1,288 rows |
| Books for a version | 0.1-0.2 ms | `books_version_book_code` |
| Daily verse | 0.04-0.06 ms | `daily_verses_day_of_year_unique` |
| Download: version lookup | 0.06-0.15 ms | index scan |
| Download: all verses, about 31,000 rows | 160-270 ms warm, 342 ms cold (107 ms of it I/O) | nested loop over `books_version_book_code`, `chapters_book_number`, `verses_chapter_number`, then an in-memory sort; JIT compiles 13 functions (about 30 ms) |
| Search | see below | |

Under load, `pg_stat_statements` put the chapter verse query at 3.8 ms mean against the engine directly and up to 16 ms when downloads competed for the disk.

Two endpoints cost far more in the engine than in Postgres: the full catalog is 947 KB of JSON and takes the engine about 100 ms of CPU per uncached request (12.8 requests a second at saturation), and a download is 5 to 10 MB. The gateway caches the catalog and coalesces concurrent misses, so the first matters only on a cold cache.

### Search

Search had no missing index. The plans were the problem: both used the global GIN indexes in ways that scale with the whole catalog, not with the translation being searched.

- **Stemmed search in one version**: Postgres joined the version's 1,189 chapters to `verses` and, for each chapter, intersected the chapter index with a fresh scan of the search term's whole GIN posting list. For "lord" that is 13,559 entries scanned 1,189 times with 7 versions vectorized, and the list grows with every version vectorized.
- **Trigram path** (languages with no Postgres dictionary, 1,194 of 1,288 versions): Postgres started from the trigram index over all 14.8M verses. Trigrams like "mun" or "ove" occur in every language, so a common word matched hundreds of thousands of rows before the version filter applied. Queries of one or two CJK characters produce no usable trigrams at all.

The fix collects the scope's chapter ids once and matches only verses in those chapters, then joins the 20 results to their chapter, book, and version. Results are identical: 8 cases including offsets of 200 and 900, both paths, and a language scope, compared row by row over 100 rows each with no differences.

| Query (ms, first run / second run) | Before | After |
|---|---|---|
| KJV "lord", 7 versions vectorized | 3,090 / 2,810 | 47 / 31 |
| KJV "lord", 30 versions vectorized | 12,504 / 12,124 | 139 / 51 |
| KJV "love", 30 versions vectorized | 2,007 / 1,612 | 250 / 112 |
| KJV "Melchizedek" (rare) | 16 / 4 | 19 / 20 |
| Swahili ONEN "Mungu" (trigram) | 4,360 / 3,706; 15 s timeout through the engine | 541 / 361 |
| Korean 1910 "하나님" (trigram) | 1,182 / 382 | 247 / 180 |
| Chinese SWCB "耶稣" (trigram) | 1,763 / 265 | 200 / 152 |
| Yoruba, language-wide "love" (1 version) | 10,729 / 298 | 159 / 56 |
| Chinese, language-wide "耶稣" (6 versions) | 39,710 / 46,036 | 3,689 / 697 |
| Swahili, language-wide "Mungu" (4 versions, 18,132 matches) | 1,204 / 878 | 1,540 / 1,666 |
| English, language-wide "love" (25 of 52 versions vectorized) | 760 / 57 | not used: 16,080 / 1,569 |

Stemmed search across several versions of a language keeps the old shape, which was faster there. The Swahili language-wide case is slower after the fix because ranking 18,132 matches no longer gets parallel workers; it is bounded, where the old shape's worst cases were not.

## Load test results

### Baseline (before any fix)

7 versions vectorized. Throughput is requests a second; latency in ms. CPU is the container's share of one core, sampled mid-run.

| Scenario | Target | Req/s | p50 | p95 | p99 | Errors | Cache hits | CPU (gateway / engine / Postgres) |
|---|---|---|---|---|---|---|---|---|
| hot | gateway | 1,034 | 41 | 90 | 148 | 0% | 100% | 101% / 0% / 0% |
| hot | engine | 200 | 216 | 431 | 974 | 0% | | - / 125% / 123% |
| cold | gateway | 89.5 | 511 | 1,017 | 1,391 | 0% | 4% | 159% / 81% / 92% |
| cold | engine | 233 | 200 | 330 | 400 | 0% | | - / 127% / 136% |
| refs | gateway | 232 | 220 | 486 | 646 | 0% | 37% | 162% / 98% / 105% |
| refs | engine | 119 | 379 | 719 | 958 | 0% | | - / 101% / 95% |
| versions | gateway | 151 | 191 | 949 | 2,462 | 0% | 87% | 141% / 27% / 28% |
| versions | engine | 12.8 | 2,814 | 12,114 | 21,202 | 0% | | - / 131% / 19% |
| search (20 users) | gateway | 334 | 22 | 66 | 187 | 1.6% | 98% | 4% / 0% / 46% |
| search (20 users) | engine | 10.6 | 167 | 12,990 | 15,150 | 5.2% | | - / 13% / 470% |
| download mix: reads | gateway | 25.8 | 1,292 | 4,406 | 5,062 | 0% | 9% | 147% / 36% / 109% |
| download mix: downloads | gateway | 0.2 | 17,426 | 40,550 | 41,326 | 78% | | |
| download mix: reads | engine | 59.3 | 565 | 1,843 | 3,310 | 0% | | - / 49% / 144% |
| download mix: downloads | engine | 0.3 | 15,246 | 15,805 | 15,961 | 56% | | |

What it shows:

- Hot reads are bounded by one gateway core, cold reads by the engine and, before the brotli fix, the gateway's miss path. Cold reads through the gateway were slower than straight to the engine.
- Search saturated Postgres (470% CPU across parallel workers) while serving 10.6 requests a second; at the gateway, 98% cache hits hid it until a miss arrived.
- Downloads starved reads and failed at the 15 s statement timeout.

### After the fixes

The host's background load varied enough that identical runs differed by up to 2x (cold reads through the old gateway measured 89.5, 43.3, 34.7, and 146 requests a second at different times). The claims below rest on interleaved before and after pairs, plan timings, and profiles rather than single runs. 30 versions vectorized from here on.

| Scenario | Run | Before | After |
|---|---|---|---|
| search, engine, 20 users | pair 1 | 3.8 req/s, p95 15,244 ms, 19.3% errors | 55.2 req/s, p95 1,366 ms, 1.1% errors |
| search, engine, 20 users | pair 2 | 3.2 req/s, p95 15,574 ms, 26.1% errors | 42.7 req/s, p95 1,517 ms, 1.4% errors |
| search, gateway, 20 users | pair 1 | 20.7 req/s, p95 9,611 ms, 7.3% errors | 811 req/s, p95 50 ms, 1.4% errors |
| download mix, engine, 40 reads/s fixed plus 4 download users | pair 1 | downloads 38% failed; reads p50 1,602 ms, p95 3,752 ms | downloads 0% failed, p50 29 s; reads p50 729 ms, p95 3,957 ms |
| download mix, engine, same | pair 2 | downloads 57% failed; reads p50 443 ms, p95 3,752 ms | downloads 0% failed, p50 19 s; reads p50 38 ms, p95 1,402 ms |
| download mix, gateway, 50 users plus 4 download users | single | 23% of downloads failed (an earlier run: 78%); reads 29.5 req/s, p95 3,411 ms | 0% failed, p50 44 s; reads 91.7 req/s, p95 1,134 ms |
| cold, gateway, 60 req/s fixed | pair 1 | p95 5,452 ms, gateway CPU 94% | p95 1,705 ms, gateway CPU 50% |
| cold, gateway, 60 req/s fixed | pair 2 | p95 592 ms, gateway CPU 66% | p95 1,207 ms, gateway CPU 75% |

After the search fix, every remaining search error was a `400` for a one-character Chinese query, which the API rejects by design (minimum two characters). The cold-read pairs do not separate the brotli change from host noise; its evidence is the profile and benchmark below.

## Findings and fixes

### 1. Search plans scaled with the catalog (engine, fixed)

Commit `f094e5b` in the engine: `perf(search): match inside the requested versions before ranking`. Evidence and results above. Single-version searches and every trigram search use the scoped shape; stemmed search across several versions keeps the index-first shape. Tests pin which shape each case gets, the ordering, and the paging parameters.

### 2. Downloads failed under load and starved reads (engine, fixed)

Commit `81cb9c9` in the engine: `fix(download): cap concurrent full-Bible downloads and give them a longer timeout`.

A CPU profile of the engine during the download mix showed its one thread 94% busy: Postgres row parsing about 15%, drizzle row mapping 11%, building the nested result 12%, JSON 9%, garbage collection 14%. While the thread was busy, Postgres backends sat blocked sending rows, so `pg_stat_statements` measured the download query at 5 to 9 s instead of 0.2 s, and the 15 s statement timeout killed it with a `500`.

- Downloads take a slot from a bulkhead (`DOWNLOAD_CONCURRENCY`, default 2). Up to 16 more wait in order; past that the engine answers `503` with `Retry-After: 10`.
- With the number of pool connections downloads can hold capped, the verse query runs under `SET LOCAL statement_timeout` of at least 60 s. The read path keeps 15 s.
- Gateway commit `7b7b9db` passes `Retry-After` through on the streaming path, which forwarded only a fixed header list.

Downloads now succeed under load but queue, so they are slow when the engine is saturated (p50 19 to 29 s in the test). The proper fix is not to build them per request; see recommendations.

### 3. Brotli setup dominated the gateway's miss path (gateway, fixed)

Commit `3abfe4f`: `perf(proxy): size the brotli window to the body being compressed`.

Profiling the gateway on cold reads put `zlib` close at 13% of the main thread, about 27% with the surrounding teardown: Node builds a fresh brotli encoder per call with the default 22-bit window, a 4 MB buffer allocated and freed each time. Benchmarked inside the gateway image, medians of five rounds of 160 compressions, eight in flight:

| Body | Variant | Output bytes | CPU per op | Main thread per op |
|---|---|---|---|---|
| John 3, 7.3 KB | brotli q5, default window (before) | 1,973 | 16.9 ms | 9.9 ms |
| John 3, 7.3 KB | brotli q5, window sized to body (after) | 1,971 | 4.1 ms | 4.4 ms |
| John 3, 7.3 KB | gzip level 6 (unchanged) | 2,121 | 1.5 ms | 1.4 ms |
| Psalm 119, 28.5 KB | brotli q5, default window (before) | 5,529 | 14.9 ms | 6.7 ms |
| Psalm 119, 28.5 KB | brotli q5, window sized to body (after) | 5,520 | 6.2 ms | 3.6 ms |
| Psalm 119, 28.5 KB | gzip level 6 (unchanged) | 5,836 | 3.3 ms | 1.8 ms |

These costs are inflated on this host, where allocation and system calls are slow; the ratio is the finding. Each cached entry is compressed once per encoding, so this only matters for misses, which is exactly the cold-read path.

### 4. Recommendations, not changed here

- **Tune production Postgres.** For the 2 GB container: `shared_buffers=512MB`, `effective_cache_size=1536MB`, `work_mem=16MB`, `maintenance_work_mem=256MB` (search index builds), and `random_page_cost=1.1` on SSD. These are the settings tested above, not an A/B against defaults; `work_mem` is per sort per connection, so revisit it if pools grow past about 40 connections.
- **Serve downloads as files.** A translation only changes on re-seed. Generating each one once (at seed time, or lazily into a small cache) and serving it with its ETag removes the heaviest work the engine does per request and makes downloads cacheable by a CDN.
- **Decide what the trigram index is worth.** It is 2.4 GB, two thirds of the build time below, and the source of the worst plans. With scoped search, single-version trigram queries scan about 31,000 verses either way; Postgres still combines the index with the chapter filter for some multi-version queries. Measure search without it on a copy before dropping it.
- **Make bulk vectorizing fast.** `search:build` creates the GIN indexes only after a first population. Later runs, after new imports, update rows under both indexes: see the next section. For bulk work, drop both GIN indexes first and let `search:build` recreate them.
- **Give the engine a migration baseline** like the gateway's, so a restored dump can boot with `MIGRATE_ON_BOOT=true`.
- **Data quality.** 1,194 chapters have no verses (partial translations), so readers navigating to them get `404`. Three abbreviations cannot be addressed by URL: " Alaba-K’abeena NT" and " Glavda NT Portion" (leading spaces) and "Matupi Chin Standard Bible w/ Strongs" (a slash).
- **JIT is not worth chasing.** It compiles 13 functions per download (about 30 ms in plans); switching it off for the engine moved the download query's mean from 164-176 ms to 152-172 ms in the engine path. Left on.
- **Engine CPU per read.** About 15% of the engine's CPU on cold reads is drizzle building SQL text for every request. Prepared queries would trim it; more engine replicas are the cheaper lever today.

## Search infrastructure: how long the full catalog takes

Built with the engine's own `buildSearchInfra` for KJV, WEB, and the largest German, French, Portuguese, Russian, and Spanish translations, then all English translations incrementally.

| Step | Measured | Full catalog, estimated |
|---|---|---|
| Vectorize, fresh (no GIN indexes) | 7 versions in 49 s: 23 s for the first (cold), 2.3 to 5.5 s each after | 94 versions with a Postgres dictionary, 2.30M verses: about 10 minutes (5 to 28 at the measured warm and cold rates) |
| `search_vector` GIN index | 31 s (27 MB, mostly the scan of `verses`) | 1 to 2 minutes, about 360 MB (scaling 27 MB by 94/7) |
| Trigram GIN index | 48 min 13 s, 2.4 GB, single-threaded in Postgres 16 | the same: it covers every verse regardless |
| **Total, fresh database** | | **about 1 hour, up to 1.5** |
| Vectorize incrementally (indexes present) | 14 s for the first extra version, then 50 s a version on average over 23 more, slowing as the trigram index's pending list kept spilling into a 2.4 GB index on a 2 GB container (42.8 GB read from disk) | the 64 versions still to do: about an hour and slowing; drop the indexes first instead |

1,194 versions (12.5M verses) have no Postgres dictionary and are served by the trigram path only. These estimates come from a shared host with `maintenance_work_mem=256MB`; production's default of 64 MB would make the index builds slower.

## Capacity guidance

Per process, on this host, which understates a dedicated VPS:

| Component | Serves | Bound by |
|---|---|---|
| Gateway, cache hits | about 1,000 req/s, p95 90 ms | one core: Node is single-threaded |
| Gateway, misses | the engine's rate, at about 8 to 12 ms of gateway CPU each here (11 to 16 ms before the brotli fix) | engine first |
| Engine, chapter or passage reads | about 120 to 230 req/s | one core |
| Engine, search | about 40 to 60 req/s for the mixed set | Postgres CPU (parallel workers) |
| Engine, downloads | about one a second, two at a time | one core |
| Postgres | reads under 1 ms warm, about 4 ms from disk | not the first bottleneck for reads; search is its heaviest work |

What that means for the owner:

- **The first bottleneck is engine CPU on uncached reads**, then gateway CPU on hits. Both are stateless, so both scale by adding processes. Current production traffic is [METRIC NEEDED: peak requests a second and cache hit ratio from the gateway's logs]; compare it with the table.
- **Add an engine replica** when engine CPU stays above about 70% of a core or cold-read p95 passes 500 ms. Each replica opens up to `DB_POOL_MAX` (20) connections; at Postgres's default `max_connections` of 100, budget about four app processes before adding PgBouncer or shrinking pools.
- **Add Redis and a second gateway replica** when the gateway stays above about 70% of a core at peak, hit p95 passes about 100 ms, or you want deploys without downtime. Redis is required first, or every replica enforces its own limits ([ADR 0002](adr/0002-stateless-gateway-and-read-caching.md)). Each replica warms its own cache.
- **Put a CDN in front** when hit traffic heads toward one gateway's ceiling (hundreds of requests a second sustained), when readers are spread across continents, or for abuse absorption. Scripture responses already carry `public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800` and strong ETags, so it is configuration. Search and downloads stay at the origin while they need keys.
- **Memory is not the constraint.** Peak use: gateway 380 MB of 768 MB with a full 128 MB read cache, engine 145 MB of 1 GB, Postgres about 1 GB of 2 GB.

## Limits of this test

- **Shared, oversubscribed host.** Other tenants kept the load average at 15 to 40 on 12 cores, peaking at 131, and the containerized daemon makes allocation and system calls slower than a plain VPS. Absolute numbers are conservative and noisy; the before and after claims rely on interleaved pairs, plan timings, profiles, and benchmarks.
- **Partial search scale.** 30 of the 94 eligible versions were vectorized (25 of 52 English). Single-version results do not depend on that; language-wide English results are at about half scale.
- **Closed-model load** for most scenarios: 50 users looping as fast as they can saturate the system, which is a stress test, not a model of real readers. The fixed-rate runs are closer to real traffic.
- **No TLS, Traefik, or network distance**, one replica of each service, no Redis.
- **Postgres settings differ from production** (tuned here, defaults there), and `pg_stat_statements` was loaded throughout.
- **Gateway cache restarted per run.** Production's cache stays warm for an hour at a time, so its hit ratio for cold-ish traffic will be higher.
- **Dataset from July 2026**; translations added since are not included.

## Reproducing

1. Create a network and `postgres:16-alpine` with the settings above and a 2 GB limit; stream the dump in with `gunzip -c bible-data.sql.gz | docker exec -i <pg> psql`.
2. Baseline the engine's migrations (SQL above), then run `buildSearchInfra` from the engine image for the versions you want searchable.
3. Build both images from their branches and run them in the network with production's memory limits.
4. Generate targets with `scripts/perf/targets.sql`, copy them and `scripts/perf/k6-load.js` into a `grafana/k6` container as `/scripts/targets.json` and `/scripts/load.js`, and run, for example, `SCENARIO=cold TARGET=gateway VUS=50 DURATION=45s`. The script defaults to the container names `pbperf-gateway` and `pbperf-engine`; set `BASE` otherwise.
