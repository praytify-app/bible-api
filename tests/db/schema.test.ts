import { describe, it, expect } from "vitest";
import { usageLogs, usageDaily, developerProfiles, platformSchema } from "../../src/db/schema.js";

describe("Platform Schema", () => {
  it("exports usageLogs table", () => {
    expect(usageLogs).toBeDefined();
  });

  it("exports usageDaily table", () => {
    expect(usageDaily).toBeDefined();
  });

  it("exports developerProfiles table", () => {
    expect(developerProfiles).toBeDefined();
  });

  it("uses 'platform' schema", () => {
    expect(platformSchema.schemaName).toBe("platform");
  });
});
