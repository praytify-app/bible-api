import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_PATH, safeReturnPath, validateLoginSearch } from "../redirect";

describe("safeReturnPath", () => {
  it.each(["/dashboard", "/dashboard/keys", "/dashboard/usage?keyId=abc&days=7", "/dashboard#plan"])(
    "keeps the dashboard path %s",
    (path) => expect(safeReturnPath(path)).toBe(path),
  );

  it.each([
    undefined,
    42,
    "",
    "https://evil.example/dashboard",
    "//evil.example/dashboard",
    "/dashboard//evil.example",
    "/dashboard\\..\\evil",
    "/dashboardx",
    "/read/WEB/JHN/3",
    "/login",
    "javascript:alert(1)",
  ])("falls back for %s", (value) => expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH));
});

describe("validateLoginSearch", () => {
  it("drops unsafe and default values", () => {
    expect(validateLoginSearch({ redirect: "https://evil.example" })).toEqual({});
    expect(validateLoginSearch({ redirect: "/dashboard" })).toEqual({});
    expect(validateLoginSearch({})).toEqual({});
  });

  it("keeps a safe deep link", () => {
    expect(validateLoginSearch({ redirect: "/dashboard/keys" })).toEqual({ redirect: "/dashboard/keys" });
  });
});
