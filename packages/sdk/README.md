# @praytify/bible

A typed, zero-dependency client for the [Praytify Bible API](https://api.praytify.bible/docs): 1,288 translations, chapters, references, side-by-side passages, full-text search, and the verse of the day. Works in browsers, Node 20+, Bun, Deno, and React Native.

```bash
npm install @praytify/bible
```

```ts
import { createClient } from "@praytify/bible";

const bible = createClient();

const psalm = await bible.chapter("WEB", "PSA", 23);           // Verse[]
const passage = await bible.passage("John 3:16-18", { version: "WEB" });
const sideBySide = await bible.parallel("John 1:1", ["WEB", "KJV"]);
const today = await bible.daily({ version: "WEB" });
const english = await bible.versions.list({ language: "eng" });
```

Reading needs no key. Search and full-Bible downloads do:

```ts
const bible = createClient({ apiKey: process.env.PRAYTIFY_BIBLE_KEY }); // pb_sk_… on servers
const hits = await bible.search("still waters", { version: "WEB", limit: 10 });
```

In browser code use a publishable key (`pb_pk_…`) restricted to your site's origins; never ship a secret key.

## Options

| Option | Default | |
|---|---|---|
| `apiKey` | none | Secret key on servers, publishable key in browsers |
| `baseUrl` | `https://api.praytify.bible` | Point at a self-hosted gateway |
| `timeoutMs` | `10000` | Per attempt |
| `retries` | `2` | Network errors, `429`, and `5xx`, with backoff that honours `Retry-After` |
| `cache` | 200 entries, 1 hour | In-memory cache for scripture reads; `false` to disable. The daily verse and search are never cached |
| `fetch` | `globalThis.fetch` | Inject your own |

## Errors

Every failure throws `PraytifyBibleError` with `status` (`0` when the request never got a response), a machine-readable `code` such as `NOT_FOUND`, `RATE_LIMITED`, or `ORIGIN_NOT_ALLOWED`, and `retryAfter` when the API sent one.

```ts
import { PraytifyBibleError } from "@praytify/bible";

try {
  await bible.passage("Hezekiah 1:1", { version: "WEB" });
} catch (err) {
  if (err instanceof PraytifyBibleError && err.isNotFound) {
    // show "that book is not in this translation"
  }
}
```

## Attribution

Many translations require attribution as a licence condition. Versions and passages carry `attribution`, `attributionUrl`, and `license`; show them with the text.

MIT licensed. Scripture text is licensed per translation.
