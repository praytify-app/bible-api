/**
 * Verse selection is one contiguous range per chapter, because that is what a
 * reference ("John 3:16-18"), a share link (`?v=16-18`) and an embed can carry.
 */

export interface VerseRange {
  start: number;
  end: number;
}

export interface VerseSelection extends VerseRange {
  /** The verse a shift-click extends from. Always inside the range. */
  anchor: number;
}

const PARAM_RE = /^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/;

/**
 * Read `?v=`. TanStack's default search parser turns `?v=16` into the number
 * 16 and leaves `?v=16-18` as a string, so both arrive here. Reversed ranges
 * are put in order; anything else is rejected.
 */
export function parseVerseParam(value: unknown): VerseRange | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1 && value <= 999 ? { start: value, end: value } : null;
  }
  if (typeof value !== "string") return null;
  const match = PARAM_RE.exec(value.trim());
  if (!match) return null;
  const a = Number(match[1]);
  const b = match[2] === undefined ? a : Number(match[2]);
  if (a < 1 || b < 1) return null;
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

export function formatVerseParam(range: VerseRange): string {
  return range.start === range.end ? String(range.start) : `${range.start}-${range.end}`;
}

/**
 * Narrow a range to the verses the chapter actually has. Some translations
 * omit verses, so `available` may have gaps; the range keeps them but its ends
 * always land on real verses. Null when nothing overlaps.
 */
export function clampRange(range: VerseRange, available: readonly number[]): VerseRange | null {
  const inside = available.filter((n) => n >= range.start && n <= range.end);
  if (inside.length === 0) return null;
  return { start: Math.min(...inside), end: Math.max(...inside) };
}

export function inRange(verse: number, range: VerseRange | null): boolean {
  return range !== null && verse >= range.start && verse <= range.end;
}

function neighbour(available: readonly number[], verse: number, step: 1 | -1): number | null {
  const sorted = [...available].sort((a, b) => a - b);
  const candidates = step === 1 ? sorted.filter((n) => n > verse) : sorted.filter((n) => n < verse).reverse();
  return candidates[0] ?? null;
}

/**
 * What a click (or Enter on a verse) does to the selection.
 *
 * - Shift: select from the anchor to this verse.
 * - Nothing selected: select this verse.
 * - Outside the range: grow the range to include it. This is how a touch
 *   reader, who has no shift key, builds "16-18" by tapping 16 then 18.
 * - An end of the range: drop it, so taps can also shrink the range.
 * - Inside the range: start again from this verse alone.
 */
export function nextSelection(
  current: VerseSelection | null,
  verse: number,
  options: { extend: boolean; available: readonly number[] },
): VerseSelection | null {
  if (!current) return { start: verse, end: verse, anchor: verse };

  if (options.extend) {
    return { start: Math.min(current.anchor, verse), end: Math.max(current.anchor, verse), anchor: current.anchor };
  }

  if (!inRange(verse, current)) {
    return { start: Math.min(current.start, verse), end: Math.max(current.end, verse), anchor: current.anchor };
  }

  if (current.start === current.end) return null;

  if (verse === current.start || verse === current.end) {
    const start = verse === current.start ? neighbour(options.available, verse, 1) : current.start;
    const end = verse === current.end ? neighbour(options.available, verse, -1) : current.end;
    if (start === null || end === null || start > end) return null;
    const anchor = Math.min(Math.max(current.anchor, start), end);
    return { start, end, anchor };
  }

  return { start: verse, end: verse, anchor: verse };
}

/** "John 3:16", "John 3:16-18", or "John 3" without a range. */
export function formatReference(bookName: string, chapter: number | string, range?: VerseRange | null): string {
  const base = `${bookName} ${chapter}`;
  return range ? `${base}:${formatVerseParam(range)}` : base;
}

/** For the live region: "Verse 16 selected", "Verses 16 to 18 selected". */
export function describeSelection(range: VerseRange | null): string {
  if (!range) return "Selection cleared";
  return range.start === range.end
    ? `Verse ${range.start} selected`
    : `Verses ${range.start} to ${range.end} selected`;
}
