import { describe, expect, it } from "vitest";
import {
  clampRange,
  describeSelection,
  formatReference,
  formatVerseParam,
  nextSelection,
  parseVerseParam,
  type VerseSelection,
} from "../selection";

const chapter = Array.from({ length: 36 }, (_, i) => i + 1);

describe("parseVerseParam", () => {
  it.each([
    [16, { start: 16, end: 16 }],
    ["16", { start: 16, end: 16 }],
    ["16-18", { start: 16, end: 18 }],
    [" 16 - 18 ", { start: 16, end: 18 }],
    ["16–18", { start: 16, end: 18 }],
    ["18-16", { start: 16, end: 18 }],
  ])("reads %j", (input, expected) => {
    expect(parseVerseParam(input)).toEqual(expected);
  });

  it.each([undefined, null, "", "0", "abc", "16,18", "16-", "1.5", 0, 2.5, -3, "1000", { v: 16 }])(
    "rejects %j",
    (input) => {
      expect(parseVerseParam(input)).toBeNull();
    },
  );

  it("round-trips through formatVerseParam", () => {
    expect(formatVerseParam(parseVerseParam("16-18")!)).toBe("16-18");
    expect(formatVerseParam(parseVerseParam(16)!)).toBe("16");
  });
});

describe("clampRange", () => {
  it("trims to the verses the chapter has", () => {
    expect(clampRange({ start: 30, end: 40 }, chapter)).toEqual({ start: 30, end: 36 });
  });

  it("returns null when nothing overlaps", () => {
    expect(clampRange({ start: 40, end: 41 }, chapter)).toBeNull();
  });

  it("lands the ends on real verses when the translation omits some", () => {
    const withGap = [19, 20, 22, 23];
    expect(clampRange({ start: 21, end: 21 }, withGap)).toBeNull();
    expect(clampRange({ start: 21, end: 23 }, withGap)).toEqual({ start: 22, end: 23 });
  });
});

describe("nextSelection", () => {
  const click = (current: VerseSelection | null, verse: number, extend = false) =>
    nextSelection(current, verse, { extend, available: chapter });

  it("selects a single verse from nothing", () => {
    expect(click(null, 16)).toEqual({ start: 16, end: 16, anchor: 16 });
  });

  it("clears when the only selected verse is clicked again", () => {
    expect(click({ start: 16, end: 16, anchor: 16 }, 16)).toBeNull();
  });

  it("grows the range to include a tapped verse outside it", () => {
    expect(click({ start: 16, end: 16, anchor: 16 }, 18)).toEqual({ start: 16, end: 18, anchor: 16 });
    expect(click({ start: 16, end: 18, anchor: 16 }, 14)).toEqual({ start: 14, end: 18, anchor: 16 });
  });

  it("drops an end of the range when it is tapped", () => {
    expect(click({ start: 16, end: 18, anchor: 16 }, 18)).toEqual({ start: 16, end: 17, anchor: 16 });
    expect(click({ start: 16, end: 18, anchor: 16 }, 16)).toEqual({ start: 17, end: 18, anchor: 17 });
  });

  it("starts again from an interior verse", () => {
    expect(click({ start: 14, end: 18, anchor: 14 }, 16)).toEqual({ start: 16, end: 16, anchor: 16 });
  });

  it("shift-click spans from the anchor, in either direction", () => {
    expect(click({ start: 16, end: 16, anchor: 16 }, 20, true)).toEqual({ start: 16, end: 20, anchor: 16 });
    expect(click({ start: 16, end: 20, anchor: 16 }, 12, true)).toEqual({ start: 12, end: 16, anchor: 16 });
    expect(click(null, 12, true)).toEqual({ start: 12, end: 12, anchor: 12 });
  });

  it("skips omitted verses when shrinking", () => {
    const withGap = [19, 20, 22, 23];
    expect(nextSelection({ start: 20, end: 23, anchor: 20 }, 20, { extend: false, available: withGap })).toEqual({
      start: 22,
      end: 23,
      anchor: 22,
    });
  });
});

describe("formatting", () => {
  it("formats references", () => {
    expect(formatReference("John", 3)).toBe("John 3");
    expect(formatReference("John", 3, { start: 16, end: 16 })).toBe("John 3:16");
    expect(formatReference("1 John", 1, { start: 8, end: 10 })).toBe("1 John 1:8-10");
  });

  it("describes the selection for the live region", () => {
    expect(describeSelection(null)).toBe("Selection cleared");
    expect(describeSelection({ start: 16, end: 16 })).toBe("Verse 16 selected");
    expect(describeSelection({ start: 16, end: 18 })).toBe("Verses 16 to 18 selected");
  });
});
