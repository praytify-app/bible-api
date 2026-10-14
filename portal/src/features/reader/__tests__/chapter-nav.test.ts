import { describe, expect, it } from "vitest";
import type { BibleBook } from "@/lib/api";
import { adjacentChapters, isOldTestament, resolveVersionSwitch } from "../chapter-nav";
import { toLangTag } from "../errors";

const book = (bookCode: string, position: number, chapterCount: number, testament = "NT"): BibleBook => ({
  id: bookCode,
  bookCode,
  name: bookCode,
  position,
  chapterCount,
  testament,
});

// Deliberately out of order: the API does not promise canonical order.
const books = [book("JHN", 43, 21), book("MAL", 39, 4, "OT"), book("MAT", 40, 28), book("REV", 66, 22)];

describe("adjacentChapters", () => {
  it("moves within a book", () => {
    const { prev, next } = adjacentChapters(books, "JHN", 3);
    expect([prev?.book.bookCode, prev?.chapter]).toEqual(["JHN", 2]);
    expect([next?.book.bookCode, next?.chapter]).toEqual(["JHN", 4]);
  });

  it("crosses book boundaries in canonical order", () => {
    const fromMatthew = adjacentChapters(books, "MAT", 1);
    expect([fromMatthew.prev?.book.bookCode, fromMatthew.prev?.chapter]).toEqual(["MAL", 4]);
    const fromMalachi = adjacentChapters(books, "MAL", 4);
    expect([fromMalachi.next?.book.bookCode, fromMalachi.next?.chapter]).toEqual(["MAT", 1]);
  });

  it("stops at the ends of the canon", () => {
    expect(adjacentChapters(books, "MAL", 1).prev).toBeNull();
    expect(adjacentChapters(books, "REV", 22).next).toBeNull();
  });

  it("has nowhere to go for a book the translation lacks", () => {
    expect(adjacentChapters(books, "GEN", 1)).toEqual({ prev: null, next: null });
  });
});

describe("resolveVersionSwitch", () => {
  it("keeps the book and chapter when the translation has them", () => {
    expect(resolveVersionSwitch(books, "JHN", 3)).toEqual({ bookCode: "JHN", chapter: 3, fallback: null });
  });

  it("falls back to the book's first chapter when the chapter is missing", () => {
    expect(resolveVersionSwitch(books, "MAL", 5)).toEqual({ bookCode: "MAL", chapter: 1, fallback: "chapter" });
  });

  it("falls back to the first book when the book is missing", () => {
    expect(resolveVersionSwitch(books, "GEN", 1)).toEqual({ bookCode: "MAL", chapter: 1, fallback: "book" });
  });

  it("returns null for a translation with no books", () => {
    expect(resolveVersionSwitch([], "JHN", 3)).toBeNull();
  });
});

describe("isOldTestament", () => {
  it.each([
    ["OT", true],
    ["old", true],
    ["NT", false],
    ["", false],
  ])("%s", (testament, expected) => {
    expect(isOldTestament(book("X", 1, 1, testament))).toBe(expected);
  });
});

describe("toLangTag", () => {
  it.each([
    ["eng", "en"],
    ["arb", "ar"],
    ["pes", "fa"],
    ["en", "en"],
    [null, undefined],
    ["not a code", undefined],
  ])("%s -> %s", (code, expected) => {
    expect(toLangTag(code)).toBe(expected);
  });
});
