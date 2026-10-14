# ADR 0001: Publishable and secret API keys

- Status: Accepted
- Date: 2026-10-14

## Context

Every API key today is a single `pb_` bearer token with full access to the keyed surface (search, `?ref=` lookup, full-Bible download). That works for server-to-server calls and fails for the two integrations this platform exists to serve:

- **Embedding in a browser.** A church website, a static blog, or the Praytify web app's search box runs in the browser, where any key is visible to anyone who opens dev tools. Shipping a full-power key there means anyone can lift it and spend the owner's quota.
- **Our own apps.** Praytify web and mobile authenticate with `MASTER_API_KEY`, one shared secret that bypasses rate limits, cannot be revoked without a redeploy of every consumer, and records all usage as `master`. A leak is unbounded and invisible.

## Options

1. **Keep one key type and tell integrators to proxy through their own server.** Zero work here, real work for every integrator, and it rules out static sites and drop-in widgets entirely.
2. **Two key types with different trust levels (chosen).** Secret keys (`pb_sk_…`) stay server-side with full access. Publishable keys (`pb_pk_…`) are safe to ship in a browser: read-only, restricted to an allowlist of origins, and on a separate rate-limit budget so embed traffic cannot starve server traffic. This is the model Stripe, Mapbox, and Algolia use for the same problem.
3. **Short-lived signed tokens minted by the integrator's backend.** Strongest isolation, but it needs a backend on the integrator's side, which defeats the purpose for static sites.

## Decision

Option 2.

- `platform.api_keys` gains `kind` (`secret` | `publishable`), `allowed_origins text[]`, and `expires_at` (migration 0001). Existing `pb_` keys become `secret` keys and keep working unchanged.
- The tier (`free` | `partner` | `internal`) stays on the account (`platform.developer_profiles.tier`), and quotas are counted per account per key kind across all of that account's keys. Per-key quotas let anyone multiply their allowance by minting keys; accounts are also capped at `MAX_KEYS_PER_USER` active keys (default 20).
- A publishable key is accepted only when the request's `Origin` (or `Referer` origin as a fallback) matches its allowlist. Wildcard subdomains (`https://*.example.org`) are allowed; a bare `*` is not.
- Publishable keys can call GET routes only, and never `/download`.
- Rate limits come from the account's tier (`src/plans.ts`), not from one global constant.
- `MASTER_API_KEY` keeps working so production Praytify does not break, but it is compared in constant time and its usage is logged. Praytify should move to an `internal`-tier secret key, which is revocable and attributable; the master key is then retired.

## Consequences

- Origin checks only bind browsers. A script can forge an `Origin` header, so a publishable key is a quota-attribution and abuse-friction tool, not a secret. That is acceptable because every route it can reach is read-only scripture text, and most of it is already public without any key.
- Key prefixes now carry meaning, so the portal can warn when someone pastes a secret key into client-side code samples.
- One migration adds three defaulted or nullable columns; no backfill beyond `kind = 'secret'`.
