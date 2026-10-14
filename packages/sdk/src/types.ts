/** Response shapes served by the Praytify Bible API (`/v1`). */

export interface Language {
  id: string;
  code: string;
  name: string;
  nativeName: string | null;
  script: string | null;
  direction: "ltr" | "rtl";
  versionCount: number;
}

export interface Version {
  id: string;
  abbreviation: string;
  name: string;
  description: string | null;
  license: string | null;
  licenseType: string;
  sourceUrl: string | null;
  attribution: string | null;
  attributionUrl: string | null;
  canonType: string;
  verseCount: number;
  hasAudio: boolean;
  languageId: string;
  language?: string | null;
  languageCode?: string | null;
  languageNativeName?: string | null;
  textDirection?: string | null;
}

export interface Book {
  id: string;
  versionId: string;
  bookCode: string;
  name: string;
  position: number;
  chapterCount: number;
  testament: "OT" | "NT" | string;
}

export interface Chapter {
  id: string;
  bookId: string;
  number: number;
  verseCount: number;
}

export interface Verse {
  id: number;
  number: number;
  text: string;
}

/** Licensing and language of the translation a response came from. */
export interface Licensing {
  license: string | null;
  attribution: string | null;
  attributionUrl: string | null;
  /** ISO 639-3, e.g. `eng`. Use `Intl.getCanonicalLocales` for an HTML `lang`. */
  languageCode?: string | null;
  textDirection?: "ltr" | "rtl" | string | null;
}

export interface Passage extends Partial<Licensing> {
  reference: string;
  version: string;
  verses: Verse[];
  bookCode?: string;
  bookName?: string;
  chapter?: number;
  /** First and last verse actually returned. */
  verseStart?: number;
  verseEnd?: number;
}

/** What `chapterWithMeta()` returns: the verses plus the chapter's licensing. */
export interface ChapterMeta extends Licensing {
  version: string;
  versionName: string;
  bookCode: string;
  bookName: string;
  chapter: number;
  licenseType?: string;
}

export interface ChapterWithMeta {
  verses: Verse[];
  meta: ChapterMeta | null;
}

export interface ParallelPassage {
  reference: string;
  /** Keyed by the version code you asked for. A version that failed carries `error`. */
  versions: Record<string, Passage | { error: string }>;
}

export interface SearchResult {
  attributionUrl?: string | null;
  id: number;
  verseNumber: number;
  chapterNumber: number;
  bookCode: string;
  bookName: string;
  text: string;
  versionAbbreviation: string;
  license: string | null;
  attribution: string | null;
  rank: number;
}

export interface DailyVerse extends Partial<Licensing> {
  dayOfYear: number;
  /** UTC date the verse is for, YYYY-MM-DD. */
  date?: string;
  reference: string;
  text: string;
  version: string;
  bookCode?: string;
  bookName?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  /** Set when the requested version lacked the verse and the curated text was used instead. */
  requestedVersion?: string;
  note?: string;
}

/** A whole translation for offline use, from `download()`. */
export interface BibleDownload {
  version: Licensing & { id: string; abbreviation: string; name: string; licenseType?: string };
  books: {
    bookCode: string;
    name: string;
    position: number;
    testament: string;
    chapters: { number: number; verses: { number: number; text: string }[] }[];
  }[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
}

export interface Page<T> {
  data: T[];
  meta?: PageMeta;
}

export interface ListVersionsParams {
  /** ISO 639-3 language code, e.g. `eng`. */
  language?: string;
  /** Matches abbreviation or name. */
  search?: string;
  hasAudio?: boolean;
  page?: number;
  /** Up to 2000 for the catalog. */
  limit?: number;
}

export interface SearchParams {
  /** Version abbreviation to search, e.g. `WEB`. */
  version?: string;
  /** ISO 639-3 language code to search across. */
  language?: string;
  /** 1 to 100, default 20. */
  limit?: number;
  offset?: number;
}
