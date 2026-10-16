import type { BibleBook } from "@/lib/api";

export interface ChapterLink {
  book: BibleBook;
  chapter: number;
}

export function sortBooks(books: readonly BibleBook[]): BibleBook[] {
  return [...books].sort((a, b) => a.position - b.position);
}

/**
 * The chapters that have text, in order. Partial translations skip numbers
 * inside a book's range; the engine lists them in missingChapters.
 */
export function availableChapters(book: BibleBook): number[] {
  const missing = new Set(book.missingChapters ?? []);
  const out: number[] = [];
  for (let n = 1; n <= book.chapterCount; n++) if (!missing.has(n)) out.push(n);
  return out;
}

export function hasChapter(book: BibleBook, chapter: number): boolean {
  return chapter >= 1 && chapter <= book.chapterCount && !(book.missingChapters ?? []).includes(chapter);
}

/** Previous and next chapter with text, crossing book boundaries in canonical order. */
export function adjacentChapters(
  books: readonly BibleBook[],
  bookCode: string,
  chapter: number,
): { prev: ChapterLink | null; next: ChapterLink | null } {
  const sorted = sortBooks(books);
  const index = sorted.findIndex((b) => b.bookCode === bookCode);
  if (index < 0) return { prev: null, next: null };
  const here = availableChapters(sorted[index]);

  let prev: ChapterLink | null = null;
  const before = here.filter((n) => n < chapter).at(-1);
  if (before !== undefined) prev = { book: sorted[index], chapter: before };
  else {
    for (let i = index - 1; i >= 0 && !prev; i--) {
      const last = availableChapters(sorted[i]).at(-1);
      if (last !== undefined) prev = { book: sorted[i], chapter: last };
    }
  }

  let next: ChapterLink | null = null;
  const after = here.find((n) => n > chapter);
  if (after !== undefined) next = { book: sorted[index], chapter: after };
  else {
    for (let i = index + 1; i < sorted.length && !next; i++) {
      const first = availableChapters(sorted[i])[0];
      if (first !== undefined) next = { book: sorted[i], chapter: first };
    }
  }

  return { prev, next };
}

export type SwitchFallback = "chapter" | "book";

export interface VersionSwitchTarget {
  bookCode: string;
  chapter: number;
  /** Why the reader did not land on the same book and chapter, if it did not. */
  fallback: SwitchFallback | null;
}

/**
 * Where to land after switching translation. Same book and chapter when the
 * new translation has them; otherwise the first chapter that exists: the
 * book's first chapter, or the translation's first book. Null when the
 * translation has no books at all.
 */
export function resolveVersionSwitch(
  books: readonly BibleBook[],
  bookCode: string,
  chapter: number,
): VersionSwitchTarget | null {
  const sorted = sortBooks(books);
  const book = sorted.find((b) => b.bookCode === bookCode);
  if (book && hasChapter(book, chapter)) return { bookCode, chapter, fallback: null };
  const firstHere = book ? availableChapters(book)[0] : undefined;
  if (book && firstHere !== undefined) return { bookCode, chapter: firstHere, fallback: "chapter" };
  for (const b of sorted) {
    const first = availableChapters(b)[0];
    if (first !== undefined) return { bookCode: b.bookCode, chapter: first, fallback: "book" };
  }
  return null;
}

const OLD_TESTAMENT = new Set(["OT", "OLD", "OLD_TESTAMENT", "OLD TESTAMENT"]);

/** Engines label the testament loosely ("OT", "old"); anything not Old is grouped with the rest. */
export function isOldTestament(book: BibleBook): boolean {
  return OLD_TESTAMENT.has(String(book.testament ?? "").trim().toUpperCase());
}
