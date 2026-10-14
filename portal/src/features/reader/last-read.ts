/**
 * Where `/read` sends a returning reader. Stored per browser only; it is a
 * convenience, so every read and write tolerates storage being unavailable
 * (private windows, blocked site data) and falls back to John 3 in WEB.
 */

export interface ReaderLocation {
  version: string;
  book: string;
  chapter: string;
}

export const LAST_READ_STORAGE_KEY = "pb-reader-last";

export const DEFAULT_READER_LOCATION: Readonly<ReaderLocation> = Object.freeze({
  version: "WEB",
  book: "JHN",
  chapter: "3",
});

// Storage is user-controlled, so a stored value is only trusted when it still
// looks like a reader URL segment. Anything else resumes at the default.
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
const BOOK_RE = /^[A-Za-z0-9]{3}$/;
const CHAPTER_RE = /^[1-9]\d{0,2}$/;

export function parseReaderLocation(value: unknown): ReaderLocation | null {
  if (!value || typeof value !== "object") return null;
  const { version, book, chapter } = value as Record<string, unknown>;
  const chapterText = typeof chapter === "number" ? String(chapter) : chapter;
  if (typeof version !== "string" || !VERSION_RE.test(version)) return null;
  if (typeof book !== "string" || !BOOK_RE.test(book)) return null;
  if (typeof chapterText !== "string" || !CHAPTER_RE.test(chapterText)) return null;
  return { version: version.toUpperCase(), book: book.toUpperCase(), chapter: chapterText };
}

/** The last chapter this browser read, or null when none is stored or it is unreadable. */
export function readLastLocation(): ReaderLocation | null {
  try {
    const raw = window.localStorage.getItem(LAST_READ_STORAGE_KEY);
    return raw ? parseReaderLocation(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Params for the `/read` redirect: the stored location when there is one, else WEB/JHN/3. */
export function readerHomeTarget(): ReaderLocation {
  return readLastLocation() ?? { ...DEFAULT_READER_LOCATION };
}

/** Record a chapter the reader actually loaded. Invalid input is ignored rather than stored. */
export function rememberLocation(location: { version: string; book: string; chapter: string | number }): void {
  const parsed = parseReaderLocation(location);
  if (!parsed) return;
  try {
    window.localStorage.setItem(LAST_READ_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Storage full or blocked: resuming is a nicety, so reading carries on.
  }
}
