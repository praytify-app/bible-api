import { describe, expect, it, vi } from "vitest";
import { createClient, PraytifyBibleError } from "../src/index.js";

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

function mockFetch(handler: Handler) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return handler(url, init);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("PraytifyBible client", () => {
  it("reads a chapter without a key and without an Authorization header", async () => {
    const { fetch, calls } = mockFetch(() => json({ data: [{ id: 1, number: 16, text: "For God so loved" }] }));
    const bible = createClient({ fetch });

    const verses = await bible.chapter("WEB", "JHN", 3);

    expect(verses[0]?.number).toBe(16);
    expect(calls[0]?.url.pathname).toBe("/v1/chapters/WEB/JHN/3/verses");
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("sends the key as a bearer token when configured", async () => {
    const { fetch, calls } = mockFetch(() => json({ data: [] }));
    await createClient({ fetch, apiKey: "pb_sk_test" }).search("love", { version: "WEB" });

    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe("Bearer pb_sk_test");
    expect(calls[0]?.url.searchParams.get("q")).toBe("love");
    expect(calls[0]?.url.searchParams.get("version")).toBe("WEB");
  });

  it("normalises snake_case search rows to camelCase", async () => {
    const { fetch } = mockFetch(() =>
      json({
        data: [
          {
            id: 9,
            verse_number: 16,
            chapter_number: 3,
            book_code: "JHN",
            book_name: "John",
            text: "For God so loved",
            version_abbreviation: "WEB",
            license: "PD",
            attribution: null,
            rank: "0.5",
          },
        ],
      })
    );
    const [hit] = await createClient({ fetch, apiKey: "k" }).search("loved");

    expect(hit).toMatchObject({ verseNumber: 16, chapterNumber: 3, bookCode: "JHN", versionAbbreviation: "WEB", rank: 0.5 });
  });

  it("caches scripture reads but never the daily verse", async () => {
    const { fetch, calls } = mockFetch((url) =>
      url.pathname === "/v1/daily" ? json({ data: { reference: "Ps 23:1" } }) : json({ data: [] })
    );
    const bible = createClient({ fetch });

    await bible.chapter("WEB", "PSA", 23);
    await bible.chapter("WEB", "PSA", 23);
    await bible.daily();
    await bible.daily();

    expect(calls.filter((c) => c.url.pathname.startsWith("/v1/chapters"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.pathname === "/v1/daily")).toHaveLength(2);
  });

  it("retries 5xx and then succeeds", async () => {
    let n = 0;
    const { fetch, calls } = mockFetch(() => (++n < 2 ? json({ error: { code: "X", message: "boom" } }, 503) : json({ data: [] })));

    await createClient({ fetch, cache: false }).chapter("WEB", "GEN", 1);

    expect(calls).toHaveLength(2);
  });

  it("does not retry a 404 and exposes a typed error", async () => {
    const { fetch, calls } = mockFetch(() => json({ error: { code: "NOT_FOUND", message: "Version 'XYZ' not found" } }, 404));

    const err = await createClient({ fetch }).versions.get("XYZ").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PraytifyBibleError);
    expect((err as PraytifyBibleError).isNotFound).toBe(true);
    expect((err as PraytifyBibleError).code).toBe("NOT_FOUND");
    expect(calls).toHaveLength(1);
  });

  it("understands the legacy gateway error envelope", async () => {
    const { fetch } = mockFetch(() => json({ error: "Unauthorized", message: "Invalid or revoked API key." }, 401));

    const err = (await createClient({ fetch, apiKey: "bad" }).search("x").catch((e: unknown) => e)) as PraytifyBibleError;

    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Invalid or revoked API key.");
  });

  it("honours Retry-After on 429", async () => {
    vi.useFakeTimers();
    let n = 0;
    const { fetch, calls } = mockFetch(() =>
      ++n < 2 ? json({ error: { code: "RATE_LIMITED", message: "slow down" } }, 429, { "retry-after": "1" }) : json({ data: [] })
    );

    const pending = createClient({ fetch }).search("x");
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2);
    await pending;
    expect(calls).toHaveLength(2);
    vi.useRealTimers();
  });

  it("reports timeouts as status 0", async () => {
    const fetch = ((_u: unknown, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof globalThis.fetch;

    const err = (await createClient({ fetch, timeoutMs: 5, retries: 0 }).daily().catch((e: unknown) => e)) as PraytifyBibleError;

    expect(err.status).toBe(0);
    expect(err.code).toBe("TIMEOUT");
  });

  it("rejects parallel() with fewer than two versions", async () => {
    await expect(createClient({ fetch: mockFetch(() => json({})).fetch }).parallel("John 3:16", ["WEB"])).rejects.toThrow(TypeError);
  });

  it("strips trailing slashes from a self-hosted base URL", async () => {
    const { fetch, calls } = mockFetch(() => json({ data: [] }));
    await createClient({ fetch, baseUrl: "https://bible.example.org/" }).languages.list();
    expect(calls[0]?.url.toString()).toBe("https://bible.example.org/v1/languages");
  });

  it("returns a chapter with its licensing metadata", async () => {
    const { fetch } = mockFetch(() =>
      json({ data: [{ id: 1, number: 1, text: "In the beginning" }], meta: { version: "WEB", bookCode: "GEN", license: "Public Domain", attribution: null, attributionUrl: null } })
    );
    const r = await createClient({ fetch }).chapterWithMeta("WEB", "GEN", 1);
    expect(r.verses).toHaveLength(1);
    expect(r.meta?.license).toBe("Public Domain");
  });

  it("downloads a translation in the books format and never caches it", async () => {
    const { fetch, calls } = mockFetch(() => json({ data: { version: { abbreviation: "WEB" }, books: [{ bookCode: "GEN", chapters: [] }] } }));
    const bible = createClient({ fetch, apiKey: "pb_sk_x" });
    const d = await bible.download("WEB");
    await bible.download("WEB");
    expect(d.books[0]?.bookCode).toBe("GEN");
    expect(calls[0]?.url.searchParams.get("format")).toBe("books");
    expect(calls).toHaveLength(2);
  });
});

