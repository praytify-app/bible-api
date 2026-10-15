/**
 * The embed builder's state, and how it round-trips through the URL so a
 * reload, a shared link, or the reader's "embed this" link restores it.
 *
 * Everything here is untrusted input (query parameters), so each field is
 * normalised to a value the widget and the snippets can carry safely.
 */

export type WidgetType = "passage" | "daily";
export type WidgetTheme = "auto" | "light" | "dark";

export interface EmbedConfig {
  type: WidgetType;
  /** Human reference such as "John 3:16-18". Ignored by the daily widget. */
  reference: string;
  /** Translation abbreviation such as "WEB". */
  version: string;
  theme: WidgetTheme;
  /** Show the "Read the chapter" link. */
  link: boolean;
  /** Show the translation's attribution. A licence condition for many translations. */
  attribution: boolean;
  /** Custom `--pb-accent` as lower-case `#rrggbb`, or null for the widget's own. */
  accent: string | null;
}

export const DEFAULT_CONFIG: Readonly<EmbedConfig> = Object.freeze({
  type: "passage",
  reference: "John 3:16",
  version: "WEB",
  theme: "auto",
  link: true,
  attribution: true,
  accent: null,
});

// Mirrors packages/embed/src/embed.ts. The widget falls back to these when the
// `api` and `reader` attributes are absent, so snippets only set them when the
// portal runs somewhere else (self-hosted, staging, local).
export const WIDGET_DEFAULT_API = "https://api.praytify.bible";
export const WIDGET_DEFAULT_READER = "https://praytify.bible";

// The widget's own surface and link colours (embed.ts STYLES), used to check
// a custom accent. A custom accent replaces the link colour in both themes.
export const WIDGET_COLOURS = Object.freeze({
  light: { background: "#FFFFFF", accent: "#4338CA" },
  dark: { background: "#17131F", accent: "#A5B4FC" },
});

/** Shown in the accent field's placeholder and error. */
export const EXAMPLE_ACCENT = "#0D9488";

const REFERENCE_MAX = 120;
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** Collapses whitespace, drops control characters, and caps the length. */
export function normalizeReference(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  return String(raw)
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, REFERENCE_MAX);
}

/** A translation abbreviation, or null when the value cannot be one. */
export function normalizeVersion(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = String(raw).trim();
  return VERSION_RE.test(value) ? value : null;
}

/** `#rrggbb` (lower case) from "#RRGGBB" or "RRGGBB"; null for anything else. */
export function normalizeAccent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = HEX_RE.exec(raw.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

function isFalse(value: unknown): boolean {
  return value === false || value === "false" || value === "0" || value === 0;
}

/**
 * Builder state from parsed search parameters. Missing or invalid values fall
 * back to the defaults; nothing from the URL is trusted as-is.
 */
export function configFromSearch(search: Record<string, unknown>): EmbedConfig {
  const reference = normalizeReference(search.ref);
  return {
    type: search.type === "daily" ? "daily" : "passage",
    reference: reference || DEFAULT_CONFIG.reference,
    version: normalizeVersion(search.version) ?? DEFAULT_CONFIG.version,
    theme: search.theme === "light" || search.theme === "dark" ? search.theme : "auto",
    link: !isFalse(search.link),
    attribution: !isFalse(search.attribution),
    accent: normalizeAccent(search.accent),
  };
}

/**
 * Search parameters for a config. `ref` and `version` are always present (the
 * reader links here with exactly those); the rest only when not the default,
 * so the common URL stays short. Booleans stay booleans: the router
 * serialises them as `link=false` and parses them back.
 */
export function configToSearch(config: EmbedConfig): Record<string, string | boolean> {
  const search: Record<string, string | boolean> = {};
  if (config.type === "daily") search.type = "daily";
  else search.ref = config.reference;
  search.version = config.version;
  if (config.theme !== "auto") search.theme = config.theme;
  if (!config.link) search.link = false;
  if (!config.attribution) search.attribution = false;
  if (config.accent) search.accent = config.accent.slice(1);
  return search;
}
