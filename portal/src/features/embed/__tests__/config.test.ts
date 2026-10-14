import { describe, expect, it } from "vitest";
import { accentShortfalls, contrastRatio, formatRatio } from "../contrast";
import {
  configFromSearch,
  configToSearch,
  DEFAULT_CONFIG,
  normalizeAccent,
  normalizeReference,
  normalizeVersion,
  WIDGET_COLOURS,
} from "../config";

describe("configFromSearch", () => {
  it("prefills from the reader's ref and version", () => {
    expect(configFromSearch({ ref: "John 3:16", version: "KJV" })).toEqual({
      ...DEFAULT_CONFIG,
      reference: "John 3:16",
      version: "KJV",
    });
  });

  it("falls back to defaults for missing or hostile values", () => {
    const config = configFromSearch({
      ref: "   ",
      version: "<script>",
      type: "nope",
      theme: "neon",
      accent: "red;background:url(x)",
    });
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("reads opt-outs as booleans or strings", () => {
    expect(configFromSearch({ link: false, attribution: "false" })).toMatchObject({ link: false, attribution: false });
    expect(configFromSearch({ link: "yes" })).toMatchObject({ link: true });
  });

  it("round-trips through configToSearch", () => {
    const config = { ...DEFAULT_CONFIG, reference: "Psalm 23", theme: "dark" as const, link: false, accent: "#0d9488" };
    expect(configFromSearch(configToSearch(config))).toEqual(config);
    const daily = { ...DEFAULT_CONFIG, type: "daily" as const, attribution: false };
    expect(configToSearch(daily)).toEqual({ type: "daily", version: "WEB", attribution: false });
  });
});

describe("normalisers", () => {
  it("collapses whitespace and control characters in a reference, and caps its length", () => {
    expect(normalizeReference(" John\t3:16\n\u0000-18 ")).toBe("John 3:16 -18");
    expect(normalizeReference("x".repeat(500))).toHaveLength(120);
    expect(normalizeReference(undefined)).toBe("");
  });

  it("accepts abbreviation-shaped versions only", () => {
    expect(normalizeVersion("WEB")).toBe("WEB");
    expect(normalizeVersion("en-kjv_1611")).toBe("en-kjv_1611");
    expect(normalizeVersion("WEB\"><x")).toBeNull();
    expect(normalizeVersion("")).toBeNull();
  });

  it("accepts six-digit hex accents only", () => {
    expect(normalizeAccent("#0D9488")).toBe("#0d9488");
    expect(normalizeAccent("0d9488")).toBe("#0d9488");
    expect(normalizeAccent("#abc")).toBeNull();
    expect(normalizeAccent("#0d9488; color: red")).toBeNull();
  });
});

describe("accent contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });

  it("passes the widget's own accents on their backgrounds", () => {
    expect(accentShortfalls(WIDGET_COLOURS.light.accent, "light")).toEqual([]);
    expect(accentShortfalls(WIDGET_COLOURS.dark.accent, "dark")).toEqual([]);
  });

  it("checks both backgrounds when the theme follows the device", () => {
    // Indigo 700 reads on white but not on the dark widget.
    const shortfalls = accentShortfalls(WIDGET_COLOURS.light.accent, "auto");
    expect(shortfalls.map((s) => s.background)).toEqual(["dark"]);
  });

  it("rounds ratios down so a near miss never reads as passing", () => {
    expect(formatRatio(4.49)).toBe("4.4:1");
  });
});
