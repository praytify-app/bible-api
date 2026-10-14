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

**Recommended fix:**

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
- **Verse of the day:** `convex/homeFeed.ts:206-219` hardcodes James 5:13 (wording suspected to be NIV, unverified). Use `bible.daily({ version })`, which now honours the requested version and rotates at midnight UTC.
- **Devotional ingest:** `scripts/devotional-ingest/shared.ts:252-275` fetches passages from bible-api.com. `bible.passage(ref, { version })` returns the same text with attribution fields from this platform.
- **Message verse embeds:** `convex/messaging.ts:746` can store a reference and resolve it with `passage()` at read time instead of copying text.
- **Web pages that show a verse:** `<praytify-verse reference="John 3:16" version="WEB">` from `packages/embed` renders with attribution and needs no key.

## 5. Attribution

Many translations require attribution. Every passage, chapter, and search response now carries `attribution`, `attributionUrl`, and `license` from the version record. Render them wherever Praytify shows scripture text.
