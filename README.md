# Praytify Bible

Open-source scripture infrastructure: 1,288 Bible translations in over a thousand languages behind a fast JSON API, a public reader at [praytify.bible](https://praytify.bible), drop-in widgets for any website, and a developer portal for keys and usage. It powers [Praytify](https://praytify.app) and is built for anyone else who wants scripture in their product.

```bash
curl https://api.praytify.bible/v1/verses?ref=John%203:16&version=WEB
```

No key needed for that. [API reference](https://api.praytify.bible/docs) · [Quick start](https://praytify.bible/docs/quickstart) · [Get a key](https://praytify.bible/dashboard/keys)

## What is in this repository

| Path | What it is |
|---|---|
| `src/` | The **gateway**: the public API at `api.praytify.bible`. Developer accounts, API keys, quotas, caching, compression, and the public API reference, in front of the engine. Hono on Node 24. |
| `portal/` | The **portal**: reader, docs, embed builder, and developer dashboard at `praytify.bible`. React 19, TanStack Router and Query, Tailwind 4. |
| `packages/sdk` | `@praytify/bible`, a typed, zero-dependency TypeScript client. |
| `packages/embed` | `<praytify-verse>` and `<praytify-daily>` web components. |
| `docs/` | Architecture decisions, gap evaluations, and integration guides. |

The scripture data and its query engine live in a sibling repository, [praytify-app/open-bible-api](https://github.com/praytify-app/open-bible-api). It is never exposed to the internet directly.

```
browser / app ──► gateway (src/) ──► engine (open-bible-api) ──► Postgres
                    │  keys, quotas, cache, CORS, docs
portal (portal/) ───┘
```

## Use the hosted API

Reading is free and needs no account:

| Endpoint | Example |
|---|---|
| Translations | `GET /v1/versions?language=eng` |
| Books in a translation | `GET /v1/versions/WEB/books` |
| A chapter | `GET /v1/chapters/WEB/JHN/3/verses` |
| A reference or range | `GET /v1/verses?ref=Psalm 23:1-4&version=WEB` |
| Several translations side by side | `GET /v1/verses?ref=John 3:16&version=WEB,KJV` |
| Verse of the day | `GET /v1/daily?version=WEB` |
| Languages | `GET /v1/languages` |

An API key unlocks full-text search (`/v1/search?q=`) and full-Bible downloads (`/v1/versions/WEB/download`), and moves you from the shared per-IP limit onto your own account quota. Create keys in the [dashboard](https://praytify.bible/dashboard/keys):

- **Secret keys** (`pb_sk_…`) are for servers. Never ship them to a browser or a mobile binary.
- **Publishable keys** (`pb_pk_…`) are safe in browser code. They only work from the origins you list, can only read, and cannot download whole Bibles.

Send a key as `Authorization: Bearer <key>`.

| Plan | Per minute | Per day |
|---|---|---|
| Anonymous (per IP) | 120 | 20,000 |
| Free account (per key kind) | 60 | 1,000 |
| Partner | 600 | 100,000 |

Every response carries `X-RateLimit-*` headers, and a `429` includes `Retry-After`. Scripture responses carry `ETag` and `Cache-Control`, so a client that sends `If-None-Match` gets a `304` and pays nothing.

**Attribution.** Many translations require it as a licence condition. Responses include `attribution`, `attributionUrl`, and `license`; show them wherever you show the text.

## Put scripture on a website

```html
<script type="module" src="https://praytify.bible/embed/v1.js"></script>

<praytify-verse reference="Romans 8:28" version="WEB"></praytify-verse>
<praytify-daily version="WEB"></praytify-daily>
```

No key, no build step, no framework. The widget renders in a shadow root, follows the visitor's light or dark preference (`theme="light|dark|auto"`), links to the full chapter, and shows the translation's attribution. Point `api` at your own gateway if you self-host. The [embed builder](https://praytify.bible/embed) writes the snippet for you.

## Use the SDK

```ts
import { createClient } from "@praytify/bible";

const bible = createClient(); // or createClient({ apiKey: process.env.PRAYTIFY_BIBLE_KEY })

const verses = await bible.chapter("WEB", "PSA", 23);
const passage = await bible.passage("John 3:16-18", { version: "WEB" });
const today = await bible.daily({ version: "WEB" });
const hits = await bible.search("still waters", { version: "WEB" }); // needs a key
```

It works in browsers, Node, Bun, Deno, and React Native; retries on `429` and `5xx` honouring `Retry-After`; times out stuck requests; and caches scripture reads in memory. See [`packages/sdk`](packages/sdk).

## Self-host

You need Docker, or Node 24 with Postgres 16 or newer.

**With Docker:**

```bash
git clone https://github.com/praytify-app/bible-api.git praytify-bible && cd praytify-bible
docker compose up -d                            # Postgres, engine, gateway, portal
docker compose --profile seed run --rm seed     # once: sample public-domain translations
```

The portal is at http://localhost:8080 and the API at http://localhost:3200 (reference at `/docs`). Email and password sign-in is on by default for self-hosted instances; add GitHub or Google OAuth credentials in `.env` if you prefer.

The compose file's `*-change-me` fallbacks are public, so its ports bind to `127.0.0.1` and the stack stays on your machine. To serve other machines, put these in `.env` before the first `docker compose up` (the database passwords are applied when Postgres first initializes):

```bash
BIND_ADDRESS=0.0.0.0                     # or keep 127.0.0.1 behind a reverse proxy on the same host
PUBLIC_API_URL=https://api.example.org
PORTAL_URL=https://bible.example.org
BETTER_AUTH_SECRET=...                   # each: openssl rand -hex 32
GATEWAY_TOKEN=...
POSTGRES_PASSWORD=...
ENGINE_DB_PASSWORD=...
GATEWAY_DB_PASSWORD=...
```

The gateway refuses to start with a placeholder `BETTER_AUTH_SECRET` or `GATEWAY_TOKEN` once `PUBLIC_API_URL` is not localhost. The engine's admin routes stay locked unless you set `ADMIN_TOKEN`.

**Local development without Docker:**

```bash
git clone https://github.com/praytify-app/bible-api.git praytify-bible
git clone https://github.com/praytify-app/open-bible-api.git
cd praytify-bible
scripts/dev-stack.sh up        # Postgres on 55432, engine on 3100, gateway on 3200, sample translations
cd portal && pnpm install && pnpm dev
```

`scripts/dev-stack.sh` seeds a small set of public-domain translations so the reader, search, and daily verse work offline. `scripts/dev-stack.sh down` stops everything.

**Production:** `docker-compose.prod.yml` is the topology praytify.bible runs on (Dokploy on a single VPS): portal, gateway, engine, and Postgres, with the engine on an internal network only. Copy `.env.production.example`, fill in the secrets, and deploy. The gateway migrates its own schema on boot.

To serve the full corpus you need the data. It is not in this repository: it is built from [eBible.org](https://ebible.org) sources by the engine's seeder, and each translation carries its own licence. See the engine README for seeding and for building the search indexes.

### Configuration

Every gateway setting is validated at boot; `.env.example` documents each one. The ones that matter most:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres for accounts, keys, and usage |
| `BIBLE_API_URL` | Where the engine listens |
| `GATEWAY_TOKEN` | Shared with the engine so it trusts the gateway's client IPs |
| `BETTER_AUTH_SECRET` | Session signing, 32+ characters |
| `GITHUB_*`, `GOOGLE_*`, `EMAIL_PASSWORD_AUTH` | Sign-in methods for the dashboard |
| `REDIS_URL` | Share rate-limit counters across several gateway replicas |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the gateway (1 behind Traefik) |
| `READ_CACHE_MAX_MB` | Size of the in-process scripture cache |

## How it is built

The decisions behind the current design are recorded as ADRs:

- [0001 Publishable and secret API keys](docs/adr/0001-publishable-and-secret-api-keys.md): why browser keys are origin-bound and read-only, and why quotas are per account.
- [0002 Stateless gateway and read caching](docs/adr/0002-stateless-gateway-and-read-caching.md): Redis or memory for counters, cached key lookups, batched usage logs, and a byte-bounded scripture cache that keeps serving during a database outage.

The latest evaluation of the platform against its goals is in [docs/GAP-EVAL-2026-10-14.md](docs/GAP-EVAL-2026-10-14.md). Integrating Praytify itself is covered in [docs/integrations/praytify.md](docs/integrations/praytify.md).

## Develop

```bash
pnpm install            # pnpm 12 (see packageManager); Node 24
pnpm dev                # gateway with reload; needs .env (copy .env.example)
pnpm typecheck
pnpm test               # unit tests, no database needed
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres pnpm test:int
```

The portal, SDK, and embed packages each have their own `package.json` with the same `typecheck`, `test`, and `build` scripts. CI runs all of them, a production dependency audit, and the Docker builds on every pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose changes and [SECURITY.md](SECURITY.md) to report a vulnerability privately.

## License

The code is [MIT](LICENSE). Scripture text is not: each translation is distributed under its own licence, recorded in the `license` and `attribution` fields of the API.
