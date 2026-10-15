import { describe, expect, it } from "vitest";
import { versionLabel, versionSlug } from "../version-slug";

describe("versionSlug", () => {
  it("keeps short URL-safe abbreviations", () => {
    expect(versionSlug({ abbreviation: "WEB", code: "engwebp" })).toBe("WEB");
  });

  it("uses the code for titles and unsafe abbreviations", () => {
    expect(versionSlug({ abbreviation: "World English Bible", code: "engwebp" })).toBe("engwebp");
    expect(versionSlug({ abbreviation: "Bible/Testament", code: "fra-x" })).toBe("fra-x");
  });

  it("falls back to the abbreviation without a code", () => {
    expect(versionSlug({ abbreviation: "World English Bible" })).toBe("World English Bible");
  });
});

describe("versionLabel", () => {
  it("pairs a short abbreviation with the name", () => {
    expect(versionLabel({ abbreviation: "WEB", name: "World English Bible" })).toBe("WEB · World English Bible");
  });

  it("does not repeat a title used as the abbreviation", () => {
    expect(versionLabel({ abbreviation: " World English Bible", name: "World English Bible" })).toBe("World English Bible");
  });
});
