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

export interface Passage {
  reference: string;
  version: string;
  verses: Verse[];
}

export interface ParallelPassage {
  reference: string;
  /** Keyed by the version code you asked for. A version that failed carries `error`. */
  versions: Record<string, Passage | { error: string }>;
}

export interface SearchResult {
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

export interface DailyVerse {
  dayOfYear: number;
  reference: string;
  text: string;
  version: string;
  requestedVersion?: string;
  note?: string;
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
