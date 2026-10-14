import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_READER_LOCATION,
  LAST_READ_STORAGE_KEY,
  parseReaderLocation,
  readerHomeTarget,
  rememberLocation,
} from "../last-read";

describe("readerHomeTarget", () => {
  it("defaults to John 3 in WEB when nothing is stored", () => {
    expect(readerHomeTarget()).toEqual({ version: "WEB", book: "JHN", chapter: "3" });
  });

  it("returns the remembered location", () => {
    rememberLocation({ version: "KJV", book: "GEN", chapter: 50 });
    expect(readerHomeTarget()).toEqual({ version: "KJV", book: "GEN", chapter: "50" });
  });

  it("returns a copy, so callers cannot mutate the default", () => {
    const target = readerHomeTarget();
    target.book = "ROM";
    expect(readerHomeTarget().book).toBe(DEFAULT_READER_LOCATION.book);
  });

  it("ignores corrupt or tampered storage", () => {
    localStorage.setItem(LAST_READ_STORAGE_KEY, "{not json");
    expect(readerHomeTarget()).toEqual(DEFAULT_READER_LOCATION);
    localStorage.setItem(
      LAST_READ_STORAGE_KEY,
      JSON.stringify({ version: "../../dashboard", book: "JHN", chapter: "3" }),
    );
    expect(readerHomeTarget()).toEqual(DEFAULT_READER_LOCATION);
  });

  it("falls back when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(readerHomeTarget()).toEqual(DEFAULT_READER_LOCATION);
  });
});

describe("rememberLocation", () => {
  it("upper-cases codes and does not store invalid input", () => {
    rememberLocation({ version: "web", book: "jhn", chapter: "3" });
    expect(JSON.parse(localStorage.getItem(LAST_READ_STORAGE_KEY)!)).toEqual({
      version: "WEB",
      book: "JHN",
      chapter: "3",
    });
    rememberLocation({ version: "WEB", book: "JOHN", chapter: "3" });
    rememberLocation({ version: "WEB", book: "JHN", chapter: "0" });
    expect(readerHomeTarget()).toEqual({ version: "WEB", book: "JHN", chapter: "3" });
  });

  it("swallows quota errors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => rememberLocation({ version: "WEB", book: "JHN", chapter: "1" })).not.toThrow();
  });
});

describe("parseReaderLocation", () => {
  it.each([null, "WEB/JHN/3", { version: "WEB" }, { version: "WEB", book: "JHN", chapter: "1.5" }])(
    "rejects %j",
    (value) => {
      expect(parseReaderLocation(value)).toBeNull();
    },
  );

  it("accepts numbered books and version codes with hyphens", () => {
    expect(parseReaderLocation({ version: "en-kjv", book: "1JN", chapter: 5 })).toEqual({
      version: "EN-KJV",
      book: "1JN",
      chapter: "5",
    });
  });
});
