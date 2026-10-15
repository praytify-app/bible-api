import { describe, expect, it } from "vitest";
import { changedFields, toValues, validateProfile } from "../profile";

const saved = toValues({ appName: "Psalter", appUrl: "https://psalter.example", description: null, tier: "free" });

describe("toValues", () => {
  it("treats a missing profile as an empty form", () => {
    expect(toValues(null)).toEqual({ appName: "", appUrl: "", description: "" });
  });
});

describe("changedFields", () => {
  it("sends nothing when nothing changed, ignoring surrounding spaces", () => {
    expect(changedFields(saved, { ...saved, appName: "  Psalter " })).toEqual({});
  });

  it("sends only the edited field, trimmed", () => {
    expect(changedFields(saved, { ...saved, description: "  A daily psalm app " })).toEqual({
      description: "A daily psalm app",
    });
  });

  it("sends an emptied field as an empty string so the gateway clears it", () => {
    expect(changedFields(saved, { ...saved, appUrl: "" })).toEqual({ appUrl: "" });
  });
});

describe("validateProfile", () => {
  it("accepts an empty URL and http or https URLs", () => {
    expect(validateProfile({ ...saved, appUrl: "" })).toEqual({});
    expect(validateProfile({ ...saved, appUrl: "http://localhost:3000" })).toEqual({});
  });

  it("rejects other schemes and over-long values", () => {
    expect(validateProfile({ ...saved, appUrl: "psalter.example" }).appUrl).toMatch(/https:\/\//);
    expect(validateProfile({ ...saved, appUrl: "javascript:alert(1)" }).appUrl).toBeDefined();
    expect(validateProfile({ ...saved, appName: "x".repeat(121) }).appName).toMatch(/120/);
  });
});
