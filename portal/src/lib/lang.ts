/**
 * CLDR's macrolanguage aliases whose replacement is a bare language: the ISO
 * 639-3 code of an individual language mapped to its macrolanguage's two-letter
 * code. Chromium and Firefox apply these inside Intl.getCanonicalLocales;
 * WebKit (Safari) does not, so Arabic reached the page as lang="arb" there.
 * The unit test checks every entry against the CLDR data in Node's ICU.
 */
export const MACROLANGUAGE_ALIASES: Readonly<Record<string, string>> = {
  arb: "ar", // Standard Arabic
  ayr: "ay",
  azj: "az",
  cmn: "zh", // Mandarin
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
  pes: "fa", // Iranian Persian
  plt: "mg",
  quz: "qu",
  src: "sc",
  swh: "sw", // Swahili
  uzn: "uz",
  ydd: "yi",
  zsm: "ms", // Standard Malay
  zyb: "za",
};

/**
 * The API reports languages as ISO 639-3 codes ("eng", "arb"). HTML `lang`
 * expects BCP 47, which prefers the two-letter code when one exists; without
 * it axe reports valid-lang and screen readers may not switch voice.
 * Canonicalising maps eng to en and arb to ar, keeps codes that have no
 * shorter form (grc, hbo), and returns undefined for anything invalid.
 */
export function toLangTag(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  try {
    const [tag] = Intl.getCanonicalLocales(code);
    if (!tag) return undefined;
    // Canonical form lowercases the language subtag, so the lookup needs no case folding.
    const [language, ...rest] = tag.split("-");
    const alias = MACROLANGUAGE_ALIASES[language];
    return alias ? [alias, ...rest].join("-") : tag;
  } catch {
    return undefined;
  }
}

/** `dir` for a version's text direction; anything but "rtl" is left-to-right. */
export function toDir(direction: string | null | undefined): "rtl" | "ltr" {
  return direction === "rtl" ? "rtl" : "ltr";
}

const LETTER = /\p{L}/gu;
const SEPARATE_LETTER_SCRIPT =
  /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Armenian}\p{Script=Georgian}]/u;

/**
 * Whether `text` keeps its shape under letter-spacing (the eyebrow's tracking).
 *
 * Latin, Greek, Cyrillic, Armenian and Georgian set each letter on its own, so
 * tracking only widens the gaps. Arabic and the other joined scripts lose the
 * joins between letters, and Indic and Southeast Asian scripts split their
 * clusters, so real Safari showed an Arabic version name as loose letters. Any
 * letter outside the allowed scripts returns false; text with no letters is fine.
 */
export function toleratesLetterSpacing(text: string): boolean {
  for (const [letter] of text.matchAll(LETTER)) {
    if (!SEPARATE_LETTER_SCRIPT.test(letter)) return false;
  }
  return true;
}
