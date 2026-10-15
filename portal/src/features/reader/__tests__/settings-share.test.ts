import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_READER_SETTINGS,
  READER_SETTINGS_STORAGE_KEY,
  loadReaderSettings,
  stepScale,
  useReaderSettings,
} from "../settings";
import { buildCopyText, embedHref, readerPath, shareUrl } from "../share";

describe("reader settings", () => {
  it("defaults when nothing is stored, and ignores values it does not recognise", () => {
    expect(loadReaderSettings()).toEqual(DEFAULT_READER_SETTINGS);
    localStorage.setItem(READER_SETTINGS_STORAGE_KEY, JSON.stringify({ scale: 9, showVerseNumbers: "no" }));
    expect(loadReaderSettings()).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("persists changes and reads them back", () => {
    const { result } = renderHook(() => useReaderSettings());
    act(() => result.current[1]({ scale: 1.25 }));
    act(() => result.current[1]({ showVerseNumbers: false }));
    expect(result.current[0]).toEqual({ scale: 1.25, showVerseNumbers: false });
    expect(loadReaderSettings()).toEqual({ scale: 1.25, showVerseNumbers: false });
  });

  it("still applies the change when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const { result } = renderHook(() => useReaderSettings());
    act(() => result.current[1]({ scale: 1.5 }));
    expect(result.current[0].scale).toBe(1.5);
  });

  it("steps the text size and stops at the ends", () => {
    expect(stepScale(1, 1)).toBe(1.125);
    expect(stepScale(1, -1)).toBe(0.875);
    expect(stepScale(0.875, -1)).toBe(0.875);
    expect(stepScale(1.75, 1)).toBe(1.75);
  });
});

describe("share helpers", () => {
  const verses = [
    { id: 1, number: 16, text: "For God so loved the world. " },
    { id: 2, number: 17, text: "For God didn't send his Son." },
    { id: 3, number: 18, text: "He who believes is not judged." },
  ];

  it("copies one verse without its number, plus reference and attribution", () => {
    expect(
      buildCopyText({
        verses,
        range: { start: 16, end: 16 },
        bookName: "John",
        chapter: 3,
        version: "WEB",
        attribution: "World English Bible, public domain.",
      }),
    ).toBe("For God so loved the world.\n\nJohn 3:16 (WEB)\nWorld English Bible, public domain.");
  });

  it("numbers verses in a range and leaves out a missing attribution line", () => {
    expect(
      buildCopyText({ verses, range: { start: 17, end: 18 }, bookName: "John", chapter: 3, version: "WEB" }),
    ).toBe("17 For God didn't send his Son. 18 He who believes is not judged.\n\nJohn 3:17-18 (WEB)");
  });

  it("builds reader, share and embed links", () => {
    expect(readerPath("WEB", "JHN", 3)).toBe("/read/WEB/JHN/3");
    expect(shareUrl("https://praytify.bible", "WEB", "JHN", 3, { start: 16, end: 18 })).toBe(
      "https://praytify.bible/read/WEB/JHN/3?v=16-18",
    );
    expect(embedHref("WEB", "JHN", 3, { start: 16, end: 18 })).toBe("/embed?ref=JHN%203%3A16-18&version=WEB");
  });
});
