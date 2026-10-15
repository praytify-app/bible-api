#!/usr/bin/env node
// WCAG contrast check for the design-system tokens in src/index.css.
//
// Reads the CSS itself (not a copy of the palette), so a token edit that breaks
// AA fails here before it ships. Alpha colours are composited over the
// background they sit on, which is how the browser renders them.
//
//   node scripts/contrast-check.mjs              table + exit 1 on any failure
//   node scripts/contrast-check.mjs --markdown   rows for docs/ui-revamp/CONTRACTS.md

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "../src/index.css"), "utf8");

// Declarations inside the first block whose selector list matches `selector`.
function block(selector) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  const vars = {};
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const raw = block(":root {");
const themes = {
  light: { ...raw, ...block(':root,\n[data-theme="light"] {') },
  dark: { ...raw, ...block('[data-theme="dark"] {') },
};

function parseColor(value, vars, depth = 0) {
  if (depth > 10) throw new Error(`var() cycle near ${value}`);
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  if (ref) {
    if (!(ref[1] in vars)) throw new Error(`undefined token ${ref[1]}`);
    return parseColor(vars[ref[1]], vars, depth + 1);
  }
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgb = value.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
  throw new Error(`unsupported colour value: ${value}`);
}

const over = (fg, bg) => ({
  r: fg.a * fg.r + (1 - fg.a) * bg.r,
  g: fg.a * fg.g + (1 - fg.a) * bg.g,
  b: fg.a * fg.b + (1 - fg.a) * bg.b,
  a: 1,
});

function luminance({ r, g, b }) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(fgToken, bgToken, vars, baseToken = "--surface-base") {
  // Translucent backgrounds sit on the page surface unless the pair names another base.
  const page = parseColor(vars[baseToken], vars);
  const bgRaw = parseColor(vars[bgToken], vars);
  const bg = bgRaw.a < 1 ? over(bgRaw, page) : bgRaw;
  const fgRaw = parseColor(vars[fgToken], vars);
  const fg = fgRaw.a < 1 ? over(fgRaw, bg) : fgRaw;
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACES = ["--surface-base", "--surface-raised", "--surface-sunken", "--surface-overlay"];
const TEXT = 4.5; // WCAG 1.4.3 normal text
const UI = 3; // WCAG 1.4.11 non-text: control edges, focus indicators, chart marks

// [foreground, background, minimum, what the pair is used for, base for a translucent background]
const pairs = [
  ...["--ink", "--ink-secondary", "--ink-muted", "--accent-text"].flatMap((fg) =>
    SURFACES.map((bg) => [fg, bg, TEXT, "text"]),
  ),
  ["--accent-text", "--accent-subtle", TEXT, "selected item, chip, info alert"],
  ["--ink", "--accent-subtle", TEXT, "text on selected row"],
  ["--ink-on-accent", "--accent", TEXT, "primary button label"],
  ["--ink-on-accent", "--accent-hover", TEXT, "primary button hover"],
  ["--ink-on-accent", "--accent-active", TEXT, "primary button pressed"],
  ["--ink-on-danger", "--danger-fill", TEXT, "danger button label"],
  ["--ink-on-danger", "--danger-hover", TEXT, "danger button hover"],
  ["--ink-inverse", "--surface-inverse", TEXT, "tooltip, inverse panel"],
  ...["success", "warning", "danger", "info"].flatMap((s) => [
    [`--${s}`, "--surface-base", TEXT, `${s} text on page`],
    [`--${s}`, "--surface-raised", TEXT, `${s} text on card`],
    [`--${s}`, `--${s}-subtle`, TEXT, `${s} alert/badge text`],
    ["--ink", `--${s}-subtle`, TEXT, `body text in ${s} alert`],
  ]),
  ["--ink", "--highlight", TEXT, "highlighted verse"],
  ["--ink-secondary", "--highlight", TEXT, "verse number in highlight"],
  ["--chart-axis", "--surface-raised", TEXT, "chart tick labels"],
  ...SURFACES.map((bg) => ["--control", bg, UI, "input, checkbox, switch edge"]),
  ...SURFACES.map((bg) => ["--focus", bg, UI, "focus outline"]),
  ["--accent", "--surface-base", UI, "primary button edge on page"],
  ["--accent", "--surface-raised", UI, "primary button edge on card"],
  // bg-committed is the same indigo in both themes. Its lightest point is the
  // 10% white highlight over indigo-600; labels and the focus outline sit on it.
  ["--ink-on-accent", "--sd-indigo-600", TEXT, "label and focus outline on committed panel"],
  ["--ink-on-accent", "--sd-committed-highlight", TEXT, "same, under the panel highlight", "--sd-indigo-600"],
  ["--chart-1", "--surface-raised", UI, "chart series 1"],
  ["--chart-2", "--surface-raised", UI, "chart series 2"],
];

// Reported for the record, never gated: these are decoration by contract.
const decorative = [
  ["--ink-faint", "--surface-base", "ornament, disabled glyph"],
  ["--hairline", "--surface-base", "rule"],
  ["--border", "--surface-raised", "card edge"],
];

const markdown = process.argv.includes("--markdown");
const short = (t) => t.replace(/^--/, "");
let failures = 0;
const rows = pairs.map(([fg, bg, min, use, base]) => {
  const l = ratio(fg, bg, themes.light, base);
  const d = ratio(fg, bg, themes.dark, base);
  const ok = l >= min && d >= min;
  if (!ok) failures++;
  return { fg: short(fg), bg: short(bg), l, d, min, use, verdict: ok ? "pass" : "FAIL" };
});
for (const [fg, bg, use] of decorative) {
  rows.push({
    fg: short(fg),
    bg: short(bg),
    l: ratio(fg, bg, themes.light),
    d: ratio(fg, bg, themes.dark),
    min: 0,
    use,
    verdict: "decorative",
  });
}

const f = (n) => n.toFixed(2);
if (markdown) {
  console.log("| Text / mark | Background | Light | Dark | Needs | Result | Used for |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const needs = r.min ? `${r.min}:1` : "none";
    console.log(`| ${r.fg} | ${r.bg} | ${f(r.l)} | ${f(r.d)} | ${needs} | ${r.verdict} | ${r.use} |`);
  }
} else {
  for (const r of rows) {
    console.log(
      `${r.verdict.padEnd(10)} ${r.fg.padEnd(16)} on ${r.bg.padEnd(17)} light ${f(r.l).padStart(5)}  dark ${f(r.d).padStart(5)}  (${r.min || "-"})`,
    );
  }
  console.log(failures ? `\n${failures} pair(s) below WCAG AA` : `\nall ${pairs.length} gated pairs meet WCAG AA`);
}
process.exit(failures ? 1 : 0);
