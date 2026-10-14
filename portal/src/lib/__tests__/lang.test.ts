import { describe, expect, it, vi } from "vitest";
import { MACROLANGUAGE_ALIASES, toDir, toLangTag } from "../lang";

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

  it.each(Object.entries(MACROLANGUAGE_ALIASES))("alias %s -> %s agrees with CLDR", (from, to) => {
    // Node's ICU applies CLDR's language aliases, so it is the reference here.
    expect(Intl.getCanonicalLocales(from)[0]).toBe(to);
  });

  it("maps macrolanguage members where Intl does not (WebKit)", () => {
    // WebKit returns arb, cmn and swh unchanged from Intl.getCanonicalLocales.
    vi.spyOn(Intl, "getCanonicalLocales").mockImplementation((locales) => [String(locales)]);
    expect(toLangTag("arb")).toBe("ar");
    expect(toLangTag("cmn")).toBe("zh");
    expect(toLangTag("swh-KE")).toBe("sw-KE");
    expect(toLangTag("grc")).toBe("grc");
  });
});

describe("toDir", () => {
  it("only treats rtl as right-to-left", () => {
    expect(toDir("rtl")).toBe("rtl");
    expect(toDir("ltr")).toBe("ltr");
    expect(toDir(null)).toBe("ltr");
  });
});
