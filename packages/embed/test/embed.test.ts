import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VERSION = {
  abbreviation: "WEB",
  name: "World English Bible",
  attribution: "World English Bible",
  attributionUrl: "https://ebible.org/web/",
  license: "Public Domain",
  languageCode: "eng",
  textDirection: "ltr",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("praytify embeds", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = "";
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/verses") {
        return respond({
          data: {
            reference: url.searchParams.get("ref"),
            version: "WEB",
            bookCode: "JHN",
            chapter: 3,
            verses: [
              { number: 16, text: "For God so loved the world," },
              { number: 17, text: "For God didn't send his Son" },
            ],
          },
        });
      }
      if (url.pathname.startsWith("/v1/versions/")) return respond({ data: VERSION });
      if (url.pathname === "/v1/daily") return respond({ data: { reference: "Psalm 23:1", text: "Yahweh is my shepherd", version: "WEB" } });
      return respond({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    await import("../src/embed.js");
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders a passage with verse numbers, citation, chapter link, and attribution", async () => {
    document.body.innerHTML = `<praytify-verse reference="John 3:16-17" version="WEB"></praytify-verse>`;
    await settle();
    const root = document.querySelector("praytify-verse")!.shadowRoot!;

    expect(root.querySelector("blockquote")?.textContent).toContain("For God so loved the world,");
    expect([...root.querySelectorAll("sup")].map((s) => s.textContent)).toEqual(["16", "17"]);
    expect(root.querySelector("cite")?.textContent).toBe("John 3:16-17 (WEB)");
    expect(root.querySelector("blockquote")?.getAttribute("lang")).toBe("en");
    const links = [...root.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("https://praytify.bible/read/WEB/JHN/3");
    expect(links).toContain("https://ebible.org/web/");
  });

  it("never interprets API text as HTML", async () => {
    fetchMock.mockImplementationOnce(async () =>
      respond({ data: { reference: "x", version: "WEB", verses: [{ number: 1, text: '<img src=x onerror="alert(1)">' }] } })
    );
    document.body.innerHTML = `<praytify-verse reference="John 1:1"></praytify-verse>`;
    await settle();
    const root = document.querySelector("praytify-verse")!.shadowRoot!;

    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("blockquote")?.textContent).toContain("<img");
  });

  it("drops non-http attribution links", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/versions/WEB") return respond({ data: { ...VERSION, attributionUrl: "javascript:alert(1)" } });
      return respond({ data: { reference: "John 1:1", version: "WEB", verses: [{ number: 1, text: "In the beginning" }] } });
    });
    document.body.innerHTML = `<praytify-verse reference="John 1:1"></praytify-verse>`;
    await settle();
    const root = document.querySelector("praytify-verse")!.shadowRoot!;

    expect([...root.querySelectorAll("a")].some((a) => a.getAttribute("href")?.startsWith("javascript"))).toBe(false);
    expect(root.textContent).toContain("World English Bible");
  });

  it("shares one version-metadata request across widgets", async () => {
    // A version no earlier test touched: custom elements stay registered across
    // module resets, so the first module's request cache outlives each test.
    document.body.innerHTML = `
      <praytify-verse reference="John 3:16" version="ASV"></praytify-verse>
      <praytify-verse reference="Romans 8:28" version="ASV"></praytify-verse>`;
    await settle();

    const versionCalls = fetchMock.mock.calls.filter(([u]) => new URL(String(u)).pathname === "/v1/versions/ASV");
    expect(versionCalls).toHaveLength(1);
  });

  it("shows a readable error and emits praytify-error when the reference is missing", async () => {
    const onError = vi.fn();
    document.addEventListener("praytify-error", onError);
    document.body.innerHTML = `<praytify-verse></praytify-verse>`;
    await settle();
    const root = document.querySelector("praytify-verse")!.shadowRoot!;

    expect(root.querySelector(".status")?.textContent).toContain("Set a reference");
    expect(onError).toHaveBeenCalledOnce();
  });

  it("renders the daily verse", async () => {
    document.body.innerHTML = `<praytify-daily></praytify-daily>`;
    await settle();
    const root = document.querySelector("praytify-daily")!.shadowRoot!;

    expect(root.querySelector("blockquote")?.textContent).toBe("Yahweh is my shepherd");
    expect(root.querySelector("sup")).toBeNull();
  });

  it("uses a self-hosted API when the api attribute is set", async () => {
    document.body.innerHTML = `<praytify-verse reference="John 3:16" api="https://bible.example.org/"></praytify-verse>`;
    await settle();

    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("https://bible.example.org/v1/verses"))).toBe(true);
  });

  it("accepts props as properties, the way React 19 sets them on custom elements", async () => {
    document.body.innerHTML = `<praytify-verse reference="John 3:16"></praytify-verse>`;
    const el = document.querySelector("praytify-verse") as HTMLElement & Record<string, unknown>;
    expect(() => {
      el.version = "KJV";
      el.api = "https://bible.example.org";
      el.reader = "https://reader.example.org";
      el.theme = "dark";
      el.link = false;
      el.attribution = true;
      el.reference = "Romans 8:28";
    }).not.toThrow();
    expect(el.getAttribute("version")).toBe("KJV");
    expect(el.getAttribute("theme")).toBe("dark");
    expect(el.getAttribute("link")).toBe("false");
    expect(el.getAttribute("reference")).toBe("Romans 8:28");
    el.reference = null;
    expect(el.hasAttribute("reference")).toBe(false);
  });

  it("re-renders when link or attribution change on a live element", async () => {
    document.body.innerHTML = `<praytify-verse reference="John 3:16-17" version="WEB"></praytify-verse>`;
    await settle();
    const el = document.querySelector("praytify-verse")!;
    const root = el.shadowRoot!;
    expect([...root.querySelectorAll("a")].some((a) => a.textContent === "Read the chapter")).toBe(true);
    el.setAttribute("link", "false");
    await settle();
    expect([...root.querySelectorAll("a")].some((a) => a.textContent === "Read the chapter")).toBe(false);
  });

  it("maps ISO 639-3 codes to valid BCP 47 language tags", async () => {
    const { toLangTag } = await import("../src/embed.js");
    expect(toLangTag("eng")).toBe("en");
    expect(toLangTag("arb")).toBe("ar");
    expect(toLangTag("grc")).toBe("grc");
    expect(toLangTag("not a code")).toBeNull();
    expect(toLangTag(null)).toBeNull();
  });
});
