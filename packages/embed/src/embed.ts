/**
 * Praytify Bible embeds: drop-in web components for any website.
 *
 *   <script type="module" src="https://praytify.bible/embed/v1.js"></script>
 *   <praytify-verse reference="John 3:16-18" version="WEB"></praytify-verse>
 *   <praytify-daily version="WEB"></praytify-daily>
 *
 * No API key, no build step, no framework. Everything renders inside a shadow
 * root so host-page CSS cannot break it and it cannot leak styles out. API text
 * is only ever assigned through textContent, never parsed as HTML.
 */

const DEFAULT_API = "https://api.praytify.bible";
const DEFAULT_READER = "https://praytify.bible";

interface Verse {
  number: number;
  text: string;
}

interface PassageResponse {
  reference: string;
  version: string;
  verses: Verse[];
  bookCode?: string;
  chapter?: number;
}

interface VersionInfo {
  abbreviation: string;
  name: string;
  attribution: string | null;
  attributionUrl: string | null;
  license: string | null;
  languageCode?: string | null;
  textDirection?: string | null;
}

interface DailyResponse {
  reference: string;
  text: string;
  version: string;
}

// One in-flight request per URL across every widget on the page, so ten
// widgets for the same version fetch its metadata once.
const requests = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  let p = requests.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url, { headers: { Accept: "application/json" } }).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } | string; message?: string } | null;
        const msg =
          (body && typeof body.error === "object" && body.error?.message) || body?.message || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      return ((await res.json()) as { data: T }).data;
    });
    requests.set(url, p);
    // Let a failed request be retried by a later widget.
    p.catch(() => requests.delete(url));
  }
  return p;
}

const STYLES = `
:host {
  --pb-bg: #FFFFFF;
  --pb-ink: #2C1810;
  --pb-muted: rgba(44, 24, 16, 0.65);
  --pb-accent: #4338CA;
  --pb-rule: rgba(44, 24, 16, 0.12);
  --pb-font-scripture: "Source Serif 4", Georgia, "Times New Roman", serif;
  --pb-font-ui: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --pb-radius: 16px;
  display: block;
  max-width: 68ch;
  color: var(--pb-ink);
}
:host([theme="dark"]) {
  --pb-bg: #17131F;
  --pb-ink: #F4EEE6;
  --pb-muted: rgba(244, 238, 230, 0.72);
  --pb-accent: #A5B4FC;
  --pb-rule: rgba(244, 238, 230, 0.16);
}
@media (prefers-color-scheme: dark) {
  :host([theme="auto"]) {
    --pb-bg: #17131F;
    --pb-ink: #F4EEE6;
    --pb-muted: rgba(244, 238, 230, 0.72);
    --pb-accent: #A5B4FC;
    --pb-rule: rgba(244, 238, 230, 0.16);
  }
}
figure {
  margin: 0;
  padding: 20px 24px;
  background: var(--pb-bg);
  border: 1px solid var(--pb-rule);
  border-radius: var(--pb-radius);
}
blockquote {
  margin: 0;
  font-family: var(--pb-font-scripture);
  font-size: 1.125rem;
  line-height: 1.6;
}
sup {
  font-family: var(--pb-font-ui);
  font-size: 0.7em;
  color: var(--pb-muted);
  margin-inline-end: 0.2em;
}
figcaption {
  margin-top: 12px;
  font-family: var(--pb-font-ui);
  font-size: 0.875rem;
  color: var(--pb-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  justify-content: space-between;
}
cite { font-style: normal; font-weight: 600; color: var(--pb-ink); }
a { color: var(--pb-accent); text-underline-offset: 2px; }
a:focus-visible { outline: 2px solid var(--pb-accent); outline-offset: 2px; border-radius: 4px; }
.status { font-family: var(--pb-font-ui); font-size: 0.875rem; color: var(--pb-muted); }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * CLDR's macrolanguage aliases whose replacement is a bare language (Standard
 * Arabic arb to ar, Mandarin cmn to zh, and so on). Chromium and Firefox apply
 * them inside Intl.getCanonicalLocales; WebKit (Safari) does not, so the widget
 * declared lang="arb" there. Kept in step with portal/src/lib/lang.ts; the
 * unit test checks every entry against CLDR.
 */
export const MACROLANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  arb: "ar",
  ayr: "ay",
  azj: "az",
  cmn: "zh",
  ekk: "et",
  fat: "ak",
  fuc: "ff",
  gaz: "om",
  gug: "gn",
  ike: "iu",
  khk: "mn",
  kmr: "ku",
  knc: "kr",
  kng: "kg",
  kpv: "kv",
  lvs: "lv",
  npi: "ne",
  ojg: "oj",
  ory: "or",
  pbu: "ps",
  pes: "fa",
  plt: "mg",
  quz: "qu",
  src: "sc",
  swh: "sw",
  uzn: "uz",
  ydd: "yi",
  zsm: "ms",
  zyb: "za",
};

/**
 * The API reports ISO 639-3 codes ("eng", "arb"). HTML lang wants BCP 47, which
 * prefers the two-letter code when one exists, or screen readers may not
 * switch voice. Canonicalising maps eng to en and arb to ar and keeps codes
 * with no shorter form (grc, hbo). Invalid input leaves lang unset.
 */
export function toLangTag(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    const tag = Intl.getCanonicalLocales(code)[0];
    if (!tag) return null;
    const [language, ...rest] = tag.split("-");
    const alias = MACROLANGUAGE_ALIASES[language];
    return alias ? [alias, ...rest].join("-") : tag;
  } catch {
    return null;
  }
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

abstract class PraytifyElement extends HTMLElement {
  protected root: ShadowRoot;
  private renderToken = 0;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  // Every attribute has a reflecting property pair. React 19 assigns props to
  // custom elements as properties when the property exists, so a getter-only
  // accessor would throw in strict mode the moment JSX renders the widget.
  protected attr(name: string): string | null {
    return this.getAttribute(name);
  }

  protected setAttr(name: string, value: unknown): void {
    if (value === null || value === undefined || value === false) this.removeAttribute(name);
    else this.setAttribute(name, value === true ? "" : String(value));
  }

  get api(): string {
    return (this.attr("api") || DEFAULT_API).replace(/\/+$/, "");
  }
  set api(v: string | null) {
    this.setAttr("api", v);
  }

  get reader(): string {
    return (this.attr("reader") || DEFAULT_READER).replace(/\/+$/, "");
  }
  set reader(v: string | null) {
    this.setAttr("reader", v);
  }

  get version(): string {
    return this.attr("version") || "WEB";
  }
  set version(v: string | null) {
    this.setAttr("version", v);
  }

  get theme(): string {
    return this.attr("theme") || "auto";
  }
  set theme(v: string | null) {
    this.setAttr("theme", v);
  }

  get link(): string | null {
    return this.attr("link");
  }
  set link(v: string | boolean | null) {
    this.setAttr("link", typeof v === "boolean" ? String(v) : v);
  }

  get attribution(): string | null {
    return this.attr("attribution");
  }
  set attribution(v: string | boolean | null) {
    this.setAttr("attribution", typeof v === "boolean" ? String(v) : v);
  }

  connectedCallback(): void {
    if (!this.hasAttribute("theme")) this.setAttribute("theme", "auto");
    void this.render();
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue !== newValue && this.isConnected) void this.render();
  }

  protected abstract load(): Promise<{ passage: PassageResponse; info: VersionInfo | null }>;

  private async render(): Promise<void> {
    const token = ++this.renderToken;
    const style = el("style", STYLES);
    const status = el("p", "Loading scripture…");
    status.className = "status";
    status.setAttribute("role", "status");
    this.root.replaceChildren(style, status);
    this.setAttribute("aria-busy", "true");

    try {
      const { passage, info } = await this.load();
      if (token !== this.renderToken) return; // a newer render superseded this one
      this.root.replaceChildren(style, this.figure(passage, info));
    } catch (err) {
      if (token !== this.renderToken) return;
      status.textContent = `Could not load this passage. ${err instanceof Error ? err.message : ""}`.trim();
      this.dispatchEvent(new CustomEvent("praytify-error", { detail: err, bubbles: true, composed: true }));
    } finally {
      if (token === this.renderToken) this.removeAttribute("aria-busy");
    }
  }

  private figure(passage: PassageResponse, info: VersionInfo | null): HTMLElement {
    const figure = el("figure");
    const quote = el("blockquote");
    const lang = toLangTag(info?.languageCode);
    if (lang) quote.lang = lang;
    if (info?.textDirection === "rtl") quote.dir = "rtl";

    const showNumbers = passage.verses.length > 1;
    passage.verses.forEach((v, i) => {
      if (showNumbers) quote.append(el("sup", String(v.number)));
      quote.append(document.createTextNode(v.text + (i < passage.verses.length - 1 ? " " : "")));
    });

    const caption = el("figcaption");
    const left = el("span");
    const cite = el("cite", `${passage.reference} (${passage.version})`);
    left.append(cite);
    if (this.getAttribute("link") !== "false" && passage.bookCode && passage.chapter) {
      const a = el("a", "Read the chapter");
      a.href = `${this.reader}/read/${encodeURIComponent(passage.version)}/${encodeURIComponent(passage.bookCode)}/${passage.chapter}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      left.append(document.createTextNode(" · "), a);
    }
    caption.append(left);

    // Attribution is a licence condition for many translations, so it renders
    // unless the host explicitly opts out and accepts that responsibility.
    if (info && this.getAttribute("attribution") !== "false") {
      const attr = el("span");
      const href = safeHttpUrl(info.attributionUrl);
      const label = info.attribution || info.name;
      if (href) {
        const a = el("a", label);
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        attr.append(a);
      } else {
        attr.textContent = label;
      }
      caption.append(attr);
    }

    figure.append(quote, caption);
    return figure;
  }

  protected versionInfo(abbreviation: string): Promise<VersionInfo | null> {
    return getJson<VersionInfo>(`${this.api}/v1/versions/${encodeURIComponent(abbreviation)}`).catch(() => null);
  }
}

export class PraytifyVerse extends PraytifyElement {
  static get observedAttributes(): string[] {
    return ["reference", "version", "api", "reader", "link", "attribution"];
  }

  get reference(): string | null {
    return this.attr("reference");
  }
  set reference(v: string | null) {
    this.setAttr("reference", v);
  }

  protected async load() {
    const reference = this.reference;
    if (!reference) throw new Error('Set a reference, e.g. reference="John 3:16".');
    const url = `${this.api}/v1/verses?ref=${encodeURIComponent(reference)}&version=${encodeURIComponent(this.version)}`;
    const [passage, info] = await Promise.all([getJson<PassageResponse>(url), this.versionInfo(this.version)]);
    return { passage, info };
  }
}

export class PraytifyDaily extends PraytifyElement {
  static get observedAttributes(): string[] {
    return ["version", "api", "reader", "link", "attribution"];
  }

  protected async load() {
    const daily = await getJson<DailyResponse>(`${this.api}/v1/daily?version=${encodeURIComponent(this.version)}`);
    const info = await this.versionInfo(daily.version);
    return {
      passage: { reference: daily.reference, version: daily.version, verses: [{ number: 0, text: daily.text }] },
      info,
    };
  }
}

if (typeof customElements !== "undefined") {
  if (!customElements.get("praytify-verse")) customElements.define("praytify-verse", PraytifyVerse);
  if (!customElements.get("praytify-daily")) customElements.define("praytify-daily", PraytifyDaily);
}
