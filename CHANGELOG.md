# Changelog

All notable changes to the gateway, portal, SDK, and embed. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-10-22

Closes the UI revamp: reader search goes live, and the portal theme keeps only its brand tokens.

### Added

- **Reader search on praytify.bible.** The portal build carries a publishable key for `https://praytify.bible` (`scripts/deploy.sh`), owned by a "Praytify Bible portal" service account on the partner tier. Self-hosted builds stay without search until they set their own `VITE_PUBLIC_SEARCH_KEY`.
- The rate-limit table on the quick start states the per-visitor share of a publishable key, from `GET /api/limits` (hidden when a gateway does not report one).

### Fixed

- `scripts/dev-stack.sh` trusts the Playwright origin (`E2E_PORT`, default 5199) as well as Vite's, so the documented end-to-end run works on a fresh stack. Before, sign-up, the auth-method list, and the docs frame were refused from the test origin unless `PORTAL_URL` was set by hand.

### Removed

- The portal theme no longer compiles Tailwind's stock palette or the deprecated `primary-*` aliases (`--color-*: initial`). Only the semantic tokens in `CONTRACTS.md` generate colour utilities, so a raw `bg-red-500` or `text-white` produces no CSS.

### Security

- **Per-client share of publishable budgets.** A publishable key ships in a web page, so one client could copy it, forge the `Origin`, and spend the account's whole allowance, switching the feature off for everyone else on the site. Each client (one IP, or one IPv6 /64) can now use at most a quarter of a publishable key's per-minute budget and a tenth of its per-day budget (15 and 100 on the free plan). Refused requests are not charged to the account. `GET /api/limits` publishes the share as `publishableClientShare`. Secret keys are unchanged. ([ADR 0001](docs/adr/0001-publishable-and-secret-api-keys.md))

## [0.5.3] - 2026-10-20 (portal)

### Fixed

- The reader's version label keeps letter-spacing only for Latin, Greek, Cyrillic, Armenian, and Georgian. Spacing broke the joins in Arabic and the clusters in Indic and Southeast Asian scripts.

## [0.5.2] - 2026-10-16 (portal)

### Fixed

- The reader skips chapters a partial translation lacks (`missingChapters` from engine 1.5.1): the picker lists only chapters with text, next and previous step over gaps, and a direct link to a missing chapter explains itself instead of a 404.

## [0.5.1] - 2026-10-16 (portal)

### Added

- Source links in the header, footer, and hero now that the repositories are public.

## [0.5.0] - 2026-10-16

The "open the platform" release: safe to share, easy to embed, fast at scale. Background and evidence in [docs/GAP-EVAL-2026-10-14.md](docs/GAP-EVAL-2026-10-14.md).

### Added

- **Publishable keys** (`pb_pk_…`): read-only, origin-restricted keys that are safe in browser code. Secret keys are now prefixed `pb_sk_`. ([ADR 0001](docs/adr/0001-publishable-and-secret-api-keys.md))
- Key expiry, rename, origin editing, and one-step **roll** in the dashboard API.
- **Per-account quotas** by tier (free, partner, internal), published at `GET /api/dashboard/plan`.
- Usage per key (`GET /api/dashboard/usage/keys`) and a `keyId` filter on daily usage.
- `GET /api/auth-methods` and opt-in email and password sign-in (`EMAIL_PASSWORD_AUTH`).
- Account export and deletion: `GET /api/dashboard/account/export` (a JSON file of everything held, without credentials) and `DELETE /api/dashboard/account` (erases the account, keys, usage, and sessions; keys stop working at once), surfaced in Settings under "Your data".
- Draft Privacy Policy, Terms of Service, Cookie Policy, and Acceptable Use Policy in `docs/legal/` with a counsel review packet, generated from `legal-config.yaml`. Not yet published.
- Least-privilege database roles (`scripts/db-roles.sql`): the engine and the gateway each own only their own tables. Self-hosted installs get them on first boot; production can switch with `ENGINE_DATABASE_URL` and `GATEWAY_DATABASE_URL`.
- `GET /api/limits` publishes the enforced anonymous and plan limits, so public pages never quote stale numbers.
- The portal is rebuilt on the Core 2 dashboard structure with the Sacred Dawn brand: mobile navigation, light and dark themes, a reader with verse selection, sharing, settings, and resume, a key manager for secret and publishable keys, an embed builder, and per-route titles. Code-split routes cut first-load JavaScript for `/` by 17.7%.
- Public **reference lookup**: `GET /v1/verses?ref=` no longer needs a key.
- **`@praytify/bible` SDK** (`packages/sdk`) and **`<praytify-verse>` / `<praytify-daily>` web components** (`packages/embed`).
- A working **public API reference** at `/docs`, generated from the engine's spec with `/v1` paths, the production server, and bearer auth.
- In-process **scripture cache** with ETags, `304` responses, brotli and gzip, request coalescing, and serve-stale during an engine or database outage. ([ADR 0002](docs/adr/0002-stateless-gateway-and-read-caching.md))
- Optional **Redis** store for rate-limit counters shared across replicas (`REDIS_URL`).
- `MIGRATE_ON_BOOT`, JSON logs with request ids, graceful shutdown, config validation at boot.
- `scripts/dev-stack.sh` for a native local stack with sample translations.
- CI (typecheck, unit and Postgres integration tests, dependency audit, Docker builds), Renovate, LICENSE (MIT), SECURITY, CONTRIBUTING, and CODE_OF_CONDUCT.

### Changed

- Quotas are counted per account and key kind instead of per key. Creating more keys no longer multiplies an account's allowance. Accounts are capped at 20 active keys.
- A keyed request to a public route counts against the account quota instead of the per-IP anonymous limit.
- Errors from the gateway use one envelope, `{ "error": { "code", "message" } }`. The SDK and portal accept both the old and the new shape.
- Gateway migrations moved to their own table (`platform.__drizzle_migrations`); an existing hand-built schema is baselined automatically.
- Usage rollups run every 10 minutes for yesterday and today in UTC, under a lock so one replica runs them.
- Profile updates are partial: only the fields sent change.
- Node 24, pnpm 12, TypeScript 7, hono 4.13, better-auth 1.7, drizzle-orm 0.45.4; the portal and engine move to current releases too.
- Production containers run read-only, without Linux capabilities, with memory limits, and health-check readiness instead of liveness. The portal runs unprivileged nginx with a strict CSP.
- Brotli on cache misses uses a window sized to the body instead of the 4 MB default: 2.4 to 4 times less CPU per compression, with output the same size or smaller. Measured at production scale in [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

### Fixed

- A reachable CORS ReDoS in hono, an OAuth account-linking flaw in better-auth, and an identifier SQL injection in drizzle-orm (dependency upgrades). `pnpm audit --prod` reports no known vulnerabilities in the gateway.
- Requests logged shortly before UTC midnight were never counted in daily usage.
- A database outage during key validation was reported as an invalid key (`401`); it is now `503`.
- The published API reference pointed at `/api/v1` paths and a spec URL that returned `404`.
- Fresh installs could not run migrations because the gateway and engine shared one migrations table.
- Streamed downloads dropped the engine's `Retry-After`, so clients could not tell when to retry a busy `503`.

### Security

- Security headers on every gateway response (HSTS, CSP, `nosniff`, framing denied), a 64 KB body limit on account routes, `405` for writes to the read-only API, upstream timeouts, constant-time master key comparison, and no internal error details in responses.
- The unused BetterAuth `bearer()` plugin is removed, so a session token alone no longer works as an API credential.
- `.env` files are excluded from the Docker build context.
- HSTS is `max-age=31536000; includeSubDomains` without `preload`; preloading is an owner decision (docs/DEPLOY.md).

### Deprecated

- `MASTER_API_KEY`. First-party apps should use an internal-tier secret key; see [docs/integrations/praytify.md](docs/integrations/praytify.md).
