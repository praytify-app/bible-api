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
    return Intl.getCanonicalLocales(code)[0];
  } catch {
    return undefined;
  }
}

/** `dir` for a version's text direction; anything but "rtl" is left-to-right. */
export function toDir(direction: string | null | undefined): "rtl" | "ltr" {
  return direction === "rtl" ? "rtl" : "ltr";
}
