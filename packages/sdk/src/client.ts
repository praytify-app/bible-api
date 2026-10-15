import { PraytifyBibleError, parseErrorBody } from "./errors.js";
import type {
  BibleDownload,
  Book,
  Chapter,
  ChapterMeta,
  ChapterWithMeta,
  DailyVerse,
  Language,
  ListVersionsParams,
  Page,
  ParallelPassage,
  Passage,
  SearchParams,
  SearchResult,
  Verse,
  Version,
} from "./types.js";

export const DEFAULT_BASE_URL = "https://api.praytify.bible";

export interface ClientOptions {
  /**
   * A secret key (`pb_sk_…`, server only) or a publishable key (`pb_pk_…`, safe in
   * browsers on the origins you allowlisted). Optional: reading the catalog,
   * chapters, references, and the daily verse works without a key.
   */
  apiKey?: string;
  /** Point at a self-hosted gateway. Defaults to https://api.praytify.bible. */
  baseUrl?: string;
  /** Inject a fetch implementation (tests, older runtimes). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Per-attempt timeout. Default 10 000 ms. */
  timeoutMs?: number;
  /** Retries for network errors, 429, and 5xx, with exponential backoff. Default 2. */
  retries?: number;
  /**
   * In-memory cache for scripture reads. Bible text only changes when the corpus
   * is re-seeded, so caching chapters in a long-lived app (React Native, a
   * server) removes most network calls. Pass `false` to disable.
   */
  cache?: false | { maxEntries?: number; ttlMs?: number };
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/** Small insertion-ordered LRU. Map iteration order gives us recency for free. */
class LruCache {
  private map = new Map<string, CacheEntry>();
  constructor(private maxEntries: number, private ttlMs: number) {}

  get(key: string): unknown | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: unknown): void {
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}

type Query = Record<string, string | number | boolean | undefined>;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

/** Normalise snake_case search rows from older engines into the documented camelCase shape. */
function toSearchResult(row: Record<string, unknown>): SearchResult {
  const pick = (camel: string, snake: string) => (row[camel] ?? row[snake]) as never;
  return {
    id: row.id as number,
    verseNumber: pick("verseNumber", "verse_number"),
    chapterNumber: pick("chapterNumber", "chapter_number"),
    bookCode: pick("bookCode", "book_code"),
    bookName: pick("bookName", "book_name"),
    text: row.text as string,
    versionAbbreviation: pick("versionAbbreviation", "version_abbreviation"),
    license: (row.license as string | null) ?? null,
    attribution: (row.attribution as string | null) ?? null,
    attributionUrl: (row.attributionUrl as string | null | undefined) ?? null,
    rank: Number(row.rank ?? 0),
  };
}

export class PraytifyBible {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly cache?: LruCache;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    const f = options.fetch ?? globalThis.fetch;
    if (!f) throw new Error("No fetch implementation found. Pass one with { fetch }.");
    // Bind so a detached method reference keeps working in browsers.
    this.fetchImpl = f.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retries = Math.max(0, options.retries ?? 2);
    if (options.cache !== false) {
      this.cache = new LruCache(options.cache?.maxEntries ?? 200, options.cache?.ttlMs ?? 60 * 60 * 1000);
    }
  }

  /** Drop every cached response, e.g. after you know the corpus was refreshed. */
  clearCache(): void {
    this.cache?.clear();
  }

  // --- Catalog ---------------------------------------------------------------

  readonly languages = {
    list: (): Promise<Language[]> => this.get<{ data: Language[] }>("/v1/languages", {}, true).then((r) => r.data),
    get: (code: string): Promise<Language> =>
      this.get<{ data: Language }>(`/v1/languages/${enc(code)}`, {}, true).then((r) => r.data),
  };

  readonly versions = {
    list: (params: ListVersionsParams = {}): Promise<Page<Version>> =>
      this.get<Page<Version>>("/v1/versions", { ...params }, true),
    /** Accepts an id or an abbreviation such as `WEB` or `KJV`. */
    get: (idOrAbbreviation: string): Promise<Version> =>
      this.get<{ data: Version }>(`/v1/versions/${enc(idOrAbbreviation)}`, {}, true).then((r) => r.data),
    books: (idOrAbbreviation: string): Promise<Book[]> =>
      this.get<{ data: Book[] }>(`/v1/versions/${enc(idOrAbbreviation)}/books`, {}, true).then((r) => r.data),
  };

  readonly books = {
    chapters: (bookId: string): Promise<Chapter[]> =>
      this.get<{ data: Chapter[] }>(`/v1/books/${enc(bookId)}/chapters`, {}, true).then((r) => r.data),
  };

  // --- Reading ---------------------------------------------------------------

  /** Every verse in one chapter, e.g. `chapter("WEB", "JHN", 3)`. */
  chapter(version: string, bookCode: string, chapter: number | string): Promise<Verse[]> {
    return this.get<{ data: Verse[] }>(
      `/v1/chapters/${enc(version)}/${enc(bookCode)}/${enc(String(chapter))}/verses`,
      {},
      true
    ).then((r) => r.data);
  }

  /** A chapter's verses plus its translation's licensing and attribution, for display. */
  chapterWithMeta(version: string, bookCode: string, chapter: number | string): Promise<ChapterWithMeta> {
    return this.get<{ data: Verse[]; meta?: ChapterMeta }>(
      `/v1/chapters/${enc(version)}/${enc(bookCode)}/${enc(String(chapter))}/verses`,
      {},
      true
    ).then((r) => ({ verses: r.data, meta: r.meta ?? null }));
  }

  /**
   * A whole translation, for offline reading. Needs a secret key (publishable
   * keys cannot download). About 5 MB for a full Bible; cache it, and the
   * response's ETag makes re-checks cheap.
   */
  download(version: string): Promise<BibleDownload> {
    return this.get<{ data: BibleDownload }>(`/v1/versions/${enc(version)}/download`, { format: "books" }, false).then(
      (r) => r.data
    );
  }

  /**
   * A verse or range by human reference, e.g. `passage("John 3:16-18", { version: "WEB" })`.
   * Accepts book names in the translation's language, common abbreviations
   * (`Jn 3:16`), USFM codes (`JHN 3:16`), and whole chapters (`Psalm 23`).
   * A reference that does not exist rejects with a 404 PraytifyBibleError.
   */
  passage(reference: string, opts: { version: string }): Promise<Passage> {
    return this.get<{ data: Passage }>("/v1/verses", { ref: reference, version: opts.version }, true).then(
      (r) => r.data
    );
  }

  /** The same reference in several versions side by side. */
  parallel(reference: string, versions: string[]): Promise<ParallelPassage> {
    if (versions.length < 2) {
      return Promise.reject(new TypeError("parallel() needs at least two versions; use passage() for one."));
    }
    return this.get<{ data: ParallelPassage }>("/v1/verses", { ref: reference, version: versions.join(",") }, true).then(
      (r) => r.data
    );
  }

  /** Verse of the day. Rotates at midnight UTC. */
  daily(opts: { version?: string } = {}): Promise<DailyVerse> {
    return this.get<{ data: DailyVerse }>("/v1/daily", { version: opts.version }, false).then((r) => r.data);
  }

  /** Full-text search. Requires an API key. */
  search(query: string, params: SearchParams = {}): Promise<SearchResult[]> {
    return this.get<{ data: Record<string, unknown>[] }>("/v1/search", { q: query, ...params }, false).then((r) =>
      r.data.map(toSearchResult)
    );
  }

  // --- Transport ---------------------------------------------------------------

  private buildUrl(path: string, query: Query): string {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  private async get<T>(path: string, query: Query, cacheable: boolean): Promise<T> {
    const url = this.buildUrl(path, query);
    if (cacheable && this.cache) {
      const hit = this.cache.get(url);
      if (hit !== undefined) return hit as T;
    }

    let lastError: PraytifyBibleError | undefined;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) {
        const backoff = lastError?.retryAfter ? lastError.retryAfter * 1000 : 250 * 2 ** (attempt - 1);
        await sleep(Math.min(backoff, 10_000));
      }
      try {
        const value = await this.once<T>(url);
        if (cacheable && this.cache) this.cache.set(url, value);
        return value;
      } catch (err) {
        if (!(err instanceof PraytifyBibleError) || !isRetryable(err.status)) throw err;
        lastError = err;
      }
    }
    throw lastError!;
  }

  private async once<T>(url: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    // Only send Authorization when there is a key: a bare GET avoids a CORS
    // preflight, which halves latency for keyless browser reads.
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers, signal: controller.signal });
    } catch (cause) {
      const timedOut = controller.signal.aborted;
      throw new PraytifyBibleError(timedOut ? `Request timed out after ${this.timeoutMs} ms` : "Network request failed", {
        status: 0,
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        cause,
      });
    } finally {
      clearTimeout(timer);
    }

    const body = await res.json().catch(() => undefined);
    if (!res.ok) {
      const { code, message } = parseErrorBody(body, res.status);
      const ra = Number(res.headers.get("retry-after"));
      throw new PraytifyBibleError(message, {
        status: res.status,
        code,
        retryAfter: Number.isFinite(ra) && ra > 0 ? ra : undefined,
      });
    }
    return body as T;
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

/** Convenience factory: `const bible = createClient({ apiKey })`. */
export function createClient(options?: ClientOptions): PraytifyBible {
  return new PraytifyBible(options);
}
