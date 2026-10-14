/**
 * The code the builder hands out. The preview renders from the same
 * `widgetAttributes()` list, so what the visitor sees is what they paste.
 *
 * The reference is free text from the visitor (or a query parameter), so
 * every value is escaped for the language it lands in: HTML attribute
 * escaping for the HTML snippet, JSON string literals for JSX expressions
 * and the SDK call. Nothing user-entered is ever placed in a comment.
 */

import { WIDGET_DEFAULT_API, WIDGET_DEFAULT_READER, type EmbedConfig } from "./config";

export interface SnippetEnv {
  /** Absolute URL of the widget script, e.g. `https://praytify.bible/embed/v1.js`. */
  scriptSrc: string;
  /** The API this portal talks to. Emitted as `api` only when it is not the widget's default. */
  apiUrl: string;
  /** This portal's origin, where chapter links should point. Emitted as `reader` only when not the default. */
  readerUrl: string;
}

export type WidgetTag = "praytify-verse" | "praytify-daily";
export type WidgetAttribute = readonly [name: string, value: string];

export function widgetTag(config: EmbedConfig): WidgetTag {
  return config.type === "daily" ? "praytify-daily" : "praytify-verse";
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** The base URL to hand the SDK and the widget, or null when it is the production default. */
export function customApi(env: SnippetEnv): string | null {
  const api = trimSlash(env.apiUrl);
  return api === WIDGET_DEFAULT_API ? null : api;
}

/**
 * Attributes for the widget element, in snippet order. Defaults are left out
 * so pasted code stays short; `explicit` keeps `theme` even when it is
 * "auto", which the preview uses so the attribute is always inspectable.
 */
export function widgetAttributes(
  config: EmbedConfig,
  env: SnippetEnv,
  { explicit = false }: { explicit?: boolean } = {},
): WidgetAttribute[] {
  const attributes: WidgetAttribute[] = [];
  if (config.type === "passage") attributes.push(["reference", config.reference]);
  attributes.push(["version", config.version]);
  if (explicit || config.theme !== "auto") attributes.push(["theme", config.theme]);
  if (!config.link) attributes.push(["link", "false"]);
  if (!config.attribution) attributes.push(["attribution", "false"]);
  const api = customApi(env);
  if (api) attributes.push(["api", api]);
  const reader = trimSlash(env.readerUrl);
  if (config.link && reader !== WIDGET_DEFAULT_READER) attributes.push(["reader", reader]);
  return attributes;
}

/** Escapes a value for a double-quoted HTML attribute. */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// One line while it reads comfortably; one attribute per line after that.
function layoutTag(open: string, attributes: string[], close: string, indent: string): string {
  const inline = `${open}${attributes.map((a) => ` ${a}`).join("")}${close}`;
  if (inline.length <= 80 || attributes.length < 2) return `${indent}${inline}`;
  return [`${indent}${open}`, ...attributes.map((a) => `${indent}  ${a}`), `${indent}${close.trimStart()}`].join("\n");
}

export function htmlSnippet(config: EmbedConfig, env: SnippetEnv): string {
  const tag = widgetTag(config);
  const attributes = widgetAttributes(config, env).map(([name, value]) => `${name}="${escapeHtmlAttribute(value)}"`);
  // The accent is validated as #rrggbb before it gets here; escaped anyway.
  if (config.accent) attributes.push(`style="${escapeHtmlAttribute(`--pb-accent: ${config.accent}`)}"`);
  return [
    `<script type="module" src="${escapeHtmlAttribute(env.scriptSrc)}"></script>`,
    layoutTag(`<${tag}`, attributes, `></${tag}>`, ""),
  ].join("\n");
}

// A JSX string attribute cannot hold a double quote and decodes HTML
// entities, so anything outside a conservative set becomes a JS expression.
const PLAIN_JSX_VALUE = /^[\p{L}\p{N} :;,.\-–/()'!?#+]*$/u;

function jsxAttribute(name: string, value: string): string {
  return PLAIN_JSX_VALUE.test(value) ? `${name}="${value}"` : `${name}={${JSON.stringify(value)}}`;
}

export function reactSnippet(config: EmbedConfig, env: SnippetEnv): string {
  const tag = widgetTag(config);
  const attributes = widgetAttributes(config, env).map(([name, value]) => jsxAttribute(name, value));
  if (config.accent) attributes.push(`style={{ "--pb-accent": ${JSON.stringify(config.accent)} }}`);
  return [
    "// Load the widget once, for example in index.html:",
    `// <script type="module" src="${escapeHtmlAttribute(env.scriptSrc)}"></script>`,
    "// TypeScript: declare the element in JSX.IntrinsicElements.",
    "",
    "export function Scripture() {",
    "  return (",
    layoutTag(`<${tag}`, attributes, " />", "    "),
    "  );",
    "}",
  ].join("\n");
}

export function sdkSnippet(config: EmbedConfig, env: SnippetEnv): string {
  const api = customApi(env);
  const client = api ? `createClient({ baseUrl: ${JSON.stringify(api)} })` : "createClient()";
  const version = JSON.stringify(config.version);
  const fetchLines =
    config.type === "daily"
      ? [
          `const today = await bible.daily({ version: ${version} });`,
          "const version = await bible.versions.get(today.version);",
          "",
          "// today.reference, today.text",
        ]
      : [
          "const [passage, version] = await Promise.all([",
          `  bible.passage(${JSON.stringify(config.reference)}, { version: ${version} }),`,
          `  bible.versions.get(${version}),`,
          "]);",
          "",
          "const text = passage.verses.map((verse) => verse.text).join(\" \");",
        ];
  return [
    'import { createClient } from "@praytify/bible";',
    "",
    `const bible = ${client};`,
    ...fetchLines,
    "// Many translations require attribution: show it with the text.",
    "const credit = version.attribution ?? version.name;",
  ].join("\n");
}
