import { describe, expect, it } from "vitest";
import type { Translation } from "@/lib/api";
import { filterCatalog, languagesOf, PAGE_SIZE, pageOf } from "../catalog";

const t = (abbreviation: string, name: string, language: string | null, languageCode: string): Translation =>
  ({ id: abbreviation, abbreviation, name, language, languageCode, textDirection: "ltr" }) as Translation;

const catalog = [
  t("WEB", "World English Bible", "English", "eng"),
  t("KJV", "King James Version", "English", "eng"),
  t("LSG", "Louis Segond Genève", "Français", "fra"),
  t("AVD", "Arabic Van Dyck Bible", "Arabic, Standard", "arb"),
  t("XYZ", "Unlabelled", null, ""),
];

describe("filterCatalog", () => {
  it("matches abbreviation, name, and language, ignoring case and accents", () => {
    expect(filterCatalog(catalog, "web", null).map((r) => r.abbreviation)).toEqual(["WEB"]);
    expect(filterCatalog(catalog, "geneve", null).map((r) => r.abbreviation)).toEqual(["LSG"]);
    expect(filterCatalog(catalog, "francais", null).map((r) => r.abbreviation)).toEqual(["LSG"]);
  });

  it("narrows by language code and tolerates a null language", () => {
    expect(filterCatalog(catalog, "", "eng")).toHaveLength(2);
    expect(filterCatalog(catalog, "", "und").map((r) => r.abbreviation)).toEqual(["XYZ"]);
    expect(() => filterCatalog(catalog, "anything", null)).not.toThrow();
  });
});

describe("languagesOf", () => {
  it("groups by code with counts, sorted by name", () => {
    expect(languagesOf(catalog)).toEqual([
      { code: "arb", name: "Arabic, Standard", count: 1 },
      { code: "eng", name: "English", count: 2 },
      { code: "fra", name: "Français", count: 1 },
      { code: "und", name: "und", count: 1 },
    ]);
  });
});

describe("pageOf", () => {
  const rows = Array.from({ length: PAGE_SIZE * 2 + 3 }, (_, i) => i);

  it("reports a 1-based range and clamps out-of-range pages", () => {
    expect(pageOf(rows, 1)).toMatchObject({ page: 1, pages: 3, from: 1, to: PAGE_SIZE });
    expect(pageOf(rows, 3)).toMatchObject({ page: 3, from: PAGE_SIZE * 2 + 1, to: PAGE_SIZE * 2 + 3 });
    expect(pageOf(rows, 99).page).toBe(3);
    expect(pageOf([], 1)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0 });
  });
});
