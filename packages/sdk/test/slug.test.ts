import { describe, expect, it } from "vitest";
import { versionSlug } from "../src/index.js";

describe("versionSlug", () => {
  it("keeps short URL-safe abbreviations", () => {
    expect(versionSlug({ abbreviation: "WEB", code: "engwebp" })).toBe("WEB");
    expect(versionSlug({ abbreviation: "OEB-CW", code: "eng-oebcw" })).toBe("OEB-CW");
  });

  it("uses the code when the abbreviation is a title or carries unsafe characters", () => {
    expect(versionSlug({ abbreviation: "World English Bible", code: "engwebp" })).toBe("engwebp");
    expect(versionSlug({ abbreviation: "Bible/Testament", code: "fra-x" })).toBe("fra-x");
  });

  it("falls back to the abbreviation when there is no code", () => {
    expect(versionSlug({ abbreviation: "English Standard Version", code: null })).toBe("English Standard Version");
    expect(versionSlug({ abbreviation: "ESV" })).toBe("ESV");
  });
});
