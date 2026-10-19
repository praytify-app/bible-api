# Integrating the Praytify app

Praytify (web at my.praytify.app, Expo mobile, Convex backend) is this platform's first and largest consumer. This guide moves it from the shared `MASTER_API_KEY` to scoped keys, closes a security hole in its web proxy, and points each feature at the API surface built for it.

Paths below are in the Praytify repository unless they start with `src/` or `packages/`.

## 1. Fix first: the web proxy hands out the master key

`apps/web/app/api/bible/[...path]/route.ts` attaches `Authorization: Bearer ${BIBLE_GATEWAY_MASTER_KEY}` to any `/v1/*` path. Its only gate, `isAllowedBibleProxyOrigin`, trusts `Origin`, `Referer`, and `Sec-Fetch-Site`, which browsers set but any script can forge:

```bash
curl -H 'Sec-Fetch-Site: same-origin' https://<praytify-web>/api/bible/search?q=love
curl -H 'Origin: https://my.praytify.app' https://<praytify-web>/api/bible/versions/WEB/download
```

Either call gets unmetered search or a full-Bible download on Praytify's quota, and floods can exhaust the shared limits real users depend on. This was found by reading the code; whether the route is deployed was not verified.

**Status: fixed and live (2026-10-19).** sireskay/praytify#99 (branch `fix/bible-proxy-auth`) is merged as `36cbae264`. It covers the web route and the same flaw in the Convex `bible.proxy` action, which forwarded any `/v1` path with the master key to any signed-in user, and adds a per-user download limit (10 an hour, failing closed) with route tests that fail against the old code. Convex was deployed first, because the web route calls its new metering mutation; the web app then shipped as image `36cbae26`. Verified in production: guest catalog and chapter reads return 200 and reach the gateway as `anonymous`, a download without a session returns 401, search through the proxy 404, and a request without an allowed `Origin` 403. The Convex action refuses anonymous callers and keyed paths such as `/v1/search`, and a call made with a test identity reaches the gateway under the Praytify key. Not yet exercised: a real signed-in browser session through the web proxy.

**The fix, in outline:**

1. Stop proxying public reads. The catalog, chapters, references (`/v1/verses?ref=`), and the daily verse are public, so the browser can call `https://api.praytify.bible` directly, with caching and ETags, and no secret leaves the server.
2. For search from the browser, use a **publishable key** restricted to Praytify's web origins (step 3 below). Publishable keys are read-only, refuse downloads, and only work from allowed origins.
3. If a server proxy is still wanted (for example to unwrap `{ data }`), give it an **internal-tier secret key**, require the signed-in app session before forwarding, and forward only an allowlist:

```ts
// apps/web/app/api/bible/[...path]/route.ts (sketch)
const ALLOWED = [/^versions(\/[^/]+(\/books)?)?$/, /^books\/[^/]+\/chapters$/, /^chapters\/.+\/verses$/, /^verses$/, /^daily$/, /^search$/];

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await getSessionFromRequest(request); // the app's real auth, not a header check
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { path } = await params;
  const joined = path.join("/");
  if (!ALLOWED.some((re) => re.test(joined))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // ...existing traversal checks and fetch, with BIBLE_GATEWAY_SECRET_KEY instead of the master key
}
```

4. Once nothing uses it, delete `MASTER_API_KEY` from the gateway environment. The gateway logs a deprecation warning at boot while it is set.

## 2. Keys for Praytify

| Consumer | Key | Why |
|---|---|---|
| Convex actions (`convex/lib/bibleApi.ts`, `convex/lib/bibleGateway.ts`) | secret, internal tier | Server-side search, references, downloads for ingest; revocable and attributed |
| Web browser search | publishable, origins `https://my.praytify.app`, `https://praytify.app` | Safe to ship in the bundle |
| Mobile app | none for reads; search through Convex | Public reads need no key; a mobile binary cannot keep a secret |

Operator steps (once, on production):

**Done 2026-10-16 (steps 1 to 3 for the server key):** a service account, "Praytify app (service account)", exists with the internal tier and one secret key, "Praytify server (Convex and web proxy)". Its email is under the reserved `.invalid` domain, so no GitHub or Google sign-in can link to it. The key is stored as `BIBLE_GATEWAY_SECRET_KEY` in the Dokploy environment of `praytify-app` / Prod (the web container) and was never printed; a keyed search against production returned 200 at 6,000 requests a minute. **Done 2026-10-19:** the same value is in the production Convex environment, Convex and web both use it, and `BIBLE_GATEWAY_MASTER_KEY` is removed from Convex and the web container. The gateway's `MASTER_API_KEY` is unset, so the old shared value now gets 401. No publishable key is needed today: Praytify's code reads none, because its web app reaches the API through the server proxy; create one only if a browser-side call is added.

1. Sign in at https://praytify.bible with the Praytify team account and save a profile.
2. Set the account's tier: `UPDATE platform.developer_profiles SET tier = 'internal' WHERE user_id = '<id>';`
3. Create the two keys in the dashboard and store them as `BIBLE_GATEWAY_SECRET_KEY` (Convex env) and `NEXT_PUBLIC_BIBLE_PUBLISHABLE_KEY` (web build env).

Internal tier allows 6,000 requests a minute and 5,000,000 a day per key kind (`src/plans.ts`). Keyed requests to public routes count against that quota instead of the per-IP anonymous limit, so Convex's shared egress IPs are not throttled together.

## 3. Use the SDK

`packages/sdk` (`@praytify/bible`) replaces the three hand-written clients (`convex/lib/bibleApi.ts`, `apps/web/lib/bible-api-web.ts`, `apps/mobile/lib/bible-api.ts`):

```ts
import { createClient } from "@praytify/bible";

const bible = createClient({ apiKey: process.env.BIBLE_GATEWAY_SECRET_KEY });
const john3 = await bible.chapter("WEB", "JHN", 3);
const passage = await bible.passage("Romans 8:28-30", { version: "WEB" });
const hits = await bible.search("still waters", { version: "WEB" });
const today = await bible.daily({ version: "WEB" });
```

It retries 429 and 5xx with `Retry-After`, times out requests, caches scripture reads in memory, and normalises search rows to camelCase. The global 429 backoff in `convex/lib/bibleGateway.ts` becomes unnecessary.

One behaviour change to plan for: a `?ref=` lookup that matches nothing in a single version now returns a `404` error instead of a `200` with `data.error`. The SDK surfaces it as `PraytifyBibleError` with `isNotFound`.

## 4. Feature by feature

- **Offline download (mobile and web):** broken today because the clients expect an array of books (`apps/web/lib/bible-db-web.ts:33-42`, `apps/web/lib/bible-api-web.ts:196`, `apps/mobile/lib/bible-api.ts:364`). The engine's download now returns `{ data: { version, name, languageCode, books: [{ bookCode, code, name, position, testament, chapters: [{ number, verses: [{ number, text }] }] }] } }` with cleaned text, built in two queries. `name`, `languageCode`, and `books[].code` are kept as aliases because they are exactly what the current Praytify clients read, so offline download should work again without an app release once the engine ships (not yet verified from the app). New code should call `bible.download(version)` server-side with the secret key; the response carries a strong `ETag`, so re-checks are a 304.
- **Version allowlist:** `convex/lib/bibleApi.ts:22-30` lists NIV, ESV, NLT, NKJV, and NASB, none of which are in the corpus (their licences do not allow redistribution). Drive the picker from `GET /v1/versions?language=eng` instead.
- **Naming versions:** most production abbreviations are full titles, some with leading spaces and one with a slash, which is why mobile guests needed the spaced-abbreviation fix in sireskay/praytify#99. From engine 1.5 every version carries a URL-safe `code` (the eBible id, such as `engwebp`), accepted anywhere an abbreviation is and matched in any case. Store and link versions by `versionSlug(version)` from the SDK: the abbreviation when it is short and URL-safe, otherwise the code. Existing stored abbreviations keep working.
- **Verse of the day:** `convex/homeFeed.ts:206-219` hardcodes James 5:13 (wording suspected to be NIV, unverified). Use `bible.daily({ version })`, which now honours the requested version and rotates at midnight UTC.
- **Devotional ingest:** `scripts/devotional-ingest/shared.ts:252-275` fetches passages from bible-api.com. `bible.passage(ref, { version })` returns the same text with attribution fields from this platform.
- **Message verse embeds:** `convex/messaging.ts:746` can store a reference and resolve it with `passage()` at read time instead of copying text.
- **Web pages that show a verse:** `<praytify-verse reference="John 3:16" version="WEB">` from `packages/embed` renders with attribution and needs no key.

## 5. Operating notes

- **Guest reads share one anonymous allowance.** The web proxy forwards guest reads without a key, so the gateway sees them as anonymous traffic from the web server's address: 120 requests a minute and 20,000 a day for every guest together. Observed traffic peaked at 13 a minute and about 900 a day (gateway logs, 2026-10-16 to 2026-10-19), so there is room. Before guest reads approach the limit, either attach the key to the proxy's allowlisted public paths (catalog and chapter reads only) or have the gateway trust the proxy's forwarded client address so each guest is limited separately.
- **Production Convex runs sireskay/praytify#97, which is not merged.** Its `encryptionScheme` field is in the live schema, so the 2026-10-19 deploy was built from main plus #99 plus #97 (branch `deploy/convex-prod-2026-10-19`). Deploying Convex from main alone would revert the direct message encryption change. Merge #97, or deploy from a tree that contains it.
- **Backups.** The nightly `backup.yml` workflow exports a Convex snapshot, encrypts it with `BACKUP_ENCRYPTION_KEY`, and keeps it as a GitHub artifact for 30 days. The decryption key is also stored in the `praytify-convex` / prod Dokploy environment, since repository secrets cannot be read back. Set `S3_BACKUP_BUCKET` (with AWS credentials) for a copy outside GitHub, and `SLACK_WEBHOOK_URL` for failure alerts.

## 6. Attribution

Many translations require attribution. Every passage, chapter, and search response now carries `attribution`, `attributionUrl`, and `license` from the version record. Render them wherever Praytify shows scripture text.
