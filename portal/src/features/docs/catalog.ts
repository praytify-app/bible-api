import type { Translation } from "@/lib/api";

/** Case- and accent-insensitive, so "genese" finds "Genèse" (same rule as SearchSelect). */
export function normalize(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export interface LanguageOption {
  code: string;
  name: string;
  count: number;
}

/**
 * One entry per language code, sorted by name. `language` is typed as a
 * string but the engine can return null (AUDIT finding 19), so every read
 * here tolerates it.
 */
export function languagesOf(list: Translation[]): LanguageOption[] {
  const byCode = new Map<string, LanguageOption>();
  for (const t of list) {
    const code = t.languageCode || "und";
    const entry = byCode.get(code);
    if (entry) entry.count += 1;
    else byCode.set(code, { code, name: t.language || code, count: 1 });
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Matches abbreviation, name, language name, or language code. An empty query matches everything. */
export function filterCatalog(list: Translation[], query: string, languageCode: string | null): Translation[] {
  const q = normalize(query);
  return list.filter((t) => {
    if (languageCode && (t.languageCode || "und") !== languageCode) return false;
    if (!q) return true;
    return [t.abbreviation, t.name, t.language, t.languageCode].some((field) => normalize(field).includes(q));
  });
}

export const PAGE_SIZE = 50;

export function pageOf<T>(rows: T[], page: number): { rows: T[]; page: number; pages: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  return { rows: slice, page: current, pages, from: slice.length ? start + 1 : 0, to: start + slice.length };
}
