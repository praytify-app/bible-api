import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type EmbedConfig } from "../config";
import { escapeHtmlAttribute, htmlSnippet, reactSnippet, sdkSnippet, widgetAttributes, type SnippetEnv } from "../snippets";

const production: SnippetEnv = {
  scriptSrc: "https://praytify.bible/embed/v1.js",
  apiUrl: "https://api.praytify.bible",
  readerUrl: "https://praytify.bible",
};
const local: SnippetEnv = {
  scriptSrc: "http://localhost:5184/embed/v1.js",
  apiUrl: "http://localhost:3200/",
  readerUrl: "http://localhost:5184",
};
const config = (overrides: Partial<EmbedConfig> = {}): EmbedConfig => ({ ...DEFAULT_CONFIG, ...overrides });

const HOSTILE = `John 3:16" onload="alert(1)"><script>alert(2)</script>&amp;`;

/** Parse a snippet the way a browser would and return its elements. */
function parse(html: string) {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  return { scripts: doc.querySelectorAll("script"), widget: doc.querySelector("praytify-verse, praytify-daily") };
}

describe("widgetAttributes", () => {
  it("leaves defaults out of the snippet against production", () => {
    expect(widgetAttributes(config(), production)).toEqual([
      ["reference", "John 3:16"],
      ["version", "WEB"],
    ]);
  });

  it("keeps theme in explicit mode, for the preview", () => {
    expect(widgetAttributes(config(), production, { explicit: true })).toContainEqual(["theme", "auto"]);
  });

  it("points a self-hosted portal's widget at its own API and reader", () => {
    const attributes = widgetAttributes(config(), local);
    expect(attributes).toContainEqual(["api", "http://localhost:3200"]);
    expect(attributes).toContainEqual(["reader", "http://localhost:5184"]);
  });

  it("drops reader when the chapter link is off, and records both opt-outs", () => {
    const attributes = widgetAttributes(config({ link: false, attribution: false }), local);
    expect(attributes).toContainEqual(["link", "false"]);
    expect(attributes).toContainEqual(["attribution", "false"]);
    expect(attributes.map(([name]) => name)).not.toContain("reader");
  });

  it("gives the daily widget no reference", () => {
    expect(widgetAttributes(config({ type: "daily" }), production)).toEqual([["version", "WEB"]]);
  });
});

describe("htmlSnippet", () => {
  it("is a module script plus the element", () => {
    expect(htmlSnippet(config(), production)).toBe(
      '<script type="module" src="https://praytify.bible/embed/v1.js"></script>\n' +
        '<praytify-verse reference="John 3:16" version="WEB"></praytify-verse>',
    );
  });

  it("escapes attribute values", () => {
    expect(escapeHtmlAttribute(`a"b<c>d&e`)).toBe("a&quot;b&lt;c&gt;d&amp;e");
  });

  it("cannot be broken out of by the reference", () => {
    const html = htmlSnippet(config({ reference: HOSTILE }), production);
    const { scripts, widget } = parse(html);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe(production.scriptSrc);
    expect(widget?.getAttribute("reference")).toBe(HOSTILE);
    expect(widget?.getAttributeNames()).toEqual(["reference", "version"]);
  });

  it("round-trips every attribute through a browser parse", () => {
    const chosen = config({ theme: "dark", link: false, attribution: false, accent: "#0d9488" });
    const { widget } = parse(htmlSnippet(chosen, local));
    expect(widget?.getAttribute("theme")).toBe("dark");
    expect(widget?.getAttribute("link")).toBe("false");
    expect(widget?.getAttribute("attribution")).toBe("false");
    expect(widget?.getAttribute("api")).toBe("http://localhost:3200");
    expect(widget?.getAttribute("style")).toBe("--pb-accent: #0d9488");
  });

  it("wraps long tags one attribute per line", () => {
    const html = htmlSnippet(config({ theme: "dark" }), local);
    expect(html.split("\n").slice(1)).toEqual([
      "<praytify-verse",
      '  reference="John 3:16"',
      '  version="WEB"',
      '  theme="dark"',
      '  api="http://localhost:3200"',
      '  reader="http://localhost:5184"',
      "></praytify-verse>",
    ]);
  });
});

describe("reactSnippet", () => {
  it("uses plain JSX strings for ordinary values", () => {
    expect(reactSnippet(config({ reference: "Psalm 23:1-3" }), production)).toContain(
      '<praytify-verse reference="Psalm 23:1-3" version="WEB" />',
    );
  });

  it("turns anything a JSX string cannot hold into a JSON expression", () => {
    const snippet = reactSnippet(config({ reference: HOSTILE }), production);
    const literal = JSON.stringify(HOSTILE);
    expect(snippet).toContain(`reference={${literal}}`);
    // Outside that string literal, nothing of the hostile text survives.
    const rest = snippet.replace(literal, "");
    expect(rest).not.toContain("alert");
    expect(rest.match(/<praytify-verse/g)).toHaveLength(1);
  });

  it("sets the accent as a custom property", () => {
    expect(reactSnippet(config({ accent: "#0d9488" }), production)).toContain('style={{ "--pb-accent": "#0d9488" }}');
  });
});

describe("sdkSnippet", () => {
  it("uses the default client against production", () => {
    const snippet = sdkSnippet(config(), production);
    expect(snippet).toContain("const bible = createClient();");
    expect(snippet).toContain('bible.passage("John 3:16", { version: "WEB" })');
  });

  it("passes baseUrl for a self-hosted API", () => {
    expect(sdkSnippet(config(), local)).toContain('createClient({ baseUrl: "http://localhost:3200" })');
  });

  it("keeps the reference inside a string literal", () => {
    const snippet = sdkSnippet(config({ reference: HOSTILE }), production);
    expect(snippet).toContain(`bible.passage(${JSON.stringify(HOSTILE)}, { version: "WEB" })`);
    // Evaluating the literal gives back exactly what was typed.
    const literal = snippet.match(/bible\.passage\(("(?:[^"\\]|\\.)*")/)?.[1] ?? "";
    expect(JSON.parse(literal)).toBe(HOSTILE);
  });

  it("calls daily() for the verse of the day", () => {
    expect(sdkSnippet(config({ type: "daily" }), production)).toContain('bible.daily({ version: "WEB" })');
  });
});
