import type { BibleBook } from "@/lib/api";

export interface ChapterLink {
  book: BibleBook;
  chapter: number;
}

export function sortBooks(books: readonly BibleBook[]): BibleBook[] {
  return [...books].sort((a, b) => a.position - b.position);
}

/** Previous and next chapter, crossing book boundaries in canonical order. */
export function adjacentChapters(
  books: readonly BibleBook[],
  bookCode: string,
  chapter: number,
): { prev: ChapterLink | null; next: ChapterLink | null } {
  const sorted = sortBooks(books);
  const index = sorted.findIndex((b) => b.bookCode === bookCode);
  if (index < 0) return { prev: null, next: null };
  const book = sorted[index];

  let prev: ChapterLink | null = null;
  if (chapter > 1) prev = { book, chapter: Math.min(chapter - 1, book.chapterCount) };
  else if (index > 0) prev = { book: sorted[index - 1], chapter: sorted[index - 1].chapterCount };

  let next: ChapterLink | null = null;
  if (chapter < book.chapterCount) next = { book, chapter: chapter + 1 };
  else if (index < sorted.length - 1) next = { book: sorted[index + 1], chapter: 1 };

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
  if (book && chapter >= 1 && chapter <= book.chapterCount) return { bookCode, chapter, fallback: null };
  if (book && book.chapterCount > 0) return { bookCode, chapter: 1, fallback: "chapter" };
  const first = sorted.find((b) => b.chapterCount > 0);
  return first ? { bookCode: first.bookCode, chapter: 1, fallback: "book" } : null;
}

const OLD_TESTAMENT = new Set(["OT", "OLD", "OLD_TESTAMENT", "OLD TESTAMENT"]);

/** Engines label the testament loosely ("OT", "old"); anything not Old is grouped with the rest. */
export function isOldTestament(book: BibleBook): boolean {
  return OLD_TESTAMENT.has(String(book.testament ?? "").trim().toUpperCase());
}
