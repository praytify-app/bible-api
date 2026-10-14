import { describe, expect, it } from "vitest";
import { toDir, toLangTag } from "../lang";

describe("toLangTag", () => {
  it.each([
    ["eng", "en"],
    ["arb", "ar"],
    ["spa", "es"],
    ["grc", "grc"],
    ["hbo", "hbo"],
  ])("maps %s to %s", (input, expected) => expect(toLangTag(input)).toBe(expected));

  it.each([null, undefined, "", "not a code"])("returns undefined for %j", (input) => {
    expect(toLangTag(input)).toBeUndefined();
  });
});

describe("toDir", () => {
  it("only treats rtl as right-to-left", () => {
    expect(toDir("rtl")).toBe("rtl");
    expect(toDir("ltr")).toBe("ltr");
    expect(toDir(null)).toBe("ltr");
  });
});
