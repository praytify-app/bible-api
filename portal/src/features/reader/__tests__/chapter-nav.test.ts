import { describe, expect, it } from "vitest";
import type { BibleBook } from "@/lib/api";
import { adjacentChapters, availableChapters, hasChapter, isOldTestament, resolveVersionSwitch } from "../chapter-nav";

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

describe("partial translations (missingChapters)", () => {
  const gappy = (code: string, position: number, count: number, missing: number[]): BibleBook => ({
    ...book(code, position, count),
    missingChapters: missing,
  });
  // EXO skips 2 and 4 and has no text past 5; LEV has no text at all; NUM is whole.
  const partial = [gappy("EXO", 2, 5, [2, 4]), gappy("LEV", 3, 0, []), book("NUM", 4, 36), gappy("GEN", 1, 3, [3])];

  it("lists only chapters with text", () => {
    expect(availableChapters(partial[0])).toEqual([1, 3, 5]);
    expect(hasChapter(partial[0], 2)).toBe(false);
    expect(hasChapter(partial[0], 3)).toBe(true);
    expect(availableChapters(book("JHN", 43, 3))).toEqual([1, 2, 3]);
  });

  it("steps over gaps inside a book", () => {
    const { prev, next } = adjacentChapters(partial, "EXO", 3);
    expect([prev?.book.bookCode, prev?.chapter]).toEqual(["EXO", 1]);
    expect([next?.book.bookCode, next?.chapter]).toEqual(["EXO", 5]);
  });

  it("skips books with no text and lands on the last real chapter going back", () => {
    expect(adjacentChapters(partial, "NUM", 1).prev).toMatchObject({ book: { bookCode: "EXO" }, chapter: 5 });
    expect(adjacentChapters(partial, "EXO", 5).next).toMatchObject({ book: { bookCode: "NUM" }, chapter: 1 });
    expect(adjacentChapters(partial, "EXO", 1).prev).toMatchObject({ book: { bookCode: "GEN" }, chapter: 2 });
  });

  it("finds neighbours from a missing chapter too", () => {
    const { prev, next } = adjacentChapters(partial, "EXO", 4);
    expect([prev?.chapter, next?.chapter]).toEqual([3, 5]);
  });

  it("switches into a translation at a real chapter", () => {
    expect(resolveVersionSwitch(partial, "EXO", 2)).toEqual({ bookCode: "EXO", chapter: 1, fallback: "chapter" });
    expect(resolveVersionSwitch(partial, "LEV", 1)).toEqual({ bookCode: "GEN", chapter: 1, fallback: "book" });
    expect(resolveVersionSwitch(partial, "EXO", 3)).toEqual({ bookCode: "EXO", chapter: 3, fallback: null });
  });
});
