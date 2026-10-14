import type { BibleVerse } from "@/lib/api";
import { formatReference, formatVerseParam, inRange, type VerseRange } from "./selection";

export interface CopyTextInput {
  verses: readonly BibleVerse[];
  range: VerseRange;
  bookName: string;
  chapter: number;
  version: string;
  /** The translation's attribution line, or its licence when it has none. */
  attribution?: string | null;
  attributionUrl?: string | null;
}

/**
 * What lands on the clipboard: the text, then the reference and translation,
 * then the attribution the licence asks for. Verse numbers are kept for a
 * range so the pasted text still maps to the reference.
 */
export function buildCopyText({
  verses,
  range,
  bookName,
  chapter,
  version,
  attribution,
  attributionUrl,
}: CopyTextInput): string {
  const picked = verses.filter((v) => inRange(v.number, range));
  const body =
    picked.length === 1 ? picked[0].text.trim() : picked.map((v) => `${v.number} ${v.text.trim()}`).join(" ");
  const lines = [body, "", `${formatReference(bookName, chapter, range)} (${version})`];
  const credit = [attribution?.trim(), attributionUrl?.trim()].filter(Boolean).join(" ");
  if (credit) lines.push(credit);
  return lines.join("\n");
}

/** Path for a chapter, with the selection when there is one: `/read/WEB/JHN/3?v=16-18`. */
export function readerPath(version: string, bookCode: string, chapter: number | string, range?: VerseRange | null): string {
  const path = `/read/${encodeURIComponent(version)}/${encodeURIComponent(bookCode)}/${chapter}`;
  return range ? `${path}?v=${formatVerseParam(range)}` : path;
}

export function shareUrl(origin: string, version: string, bookCode: string, chapter: number, range: VerseRange): string {
  return `${origin}${readerPath(version, bookCode, chapter, range)}`;
}

/**
 * The embed builder reads `ref` and `version`. The reference uses the USFM
 * code ("JHN 3:16-18") because the engine resolves codes in every translation,
 * while a localised book name only resolves in its own.
 */
export function embedHref(version: string, bookCode: string, chapter: number, range: VerseRange): string {
  // %20 rather than URLSearchParams' "+", which only some parsers read as a space.
  const ref = encodeURIComponent(formatReference(bookCode, chapter, range));
  return `/embed?ref=${ref}&version=${encodeURIComponent(version)}`;
}
