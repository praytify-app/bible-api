import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDay, utcDays, zeroFill } from "../fill";
import { usageHref, validateUsageSearch } from "../search";

const KEY = "3f2a8c1e-9b7d-4e6f-a1b2-c3d4e5f60718";

describe("utcDays", () => {
  it("lists every date inclusive, across a month end", () => {
    expect(utcDays("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("accepts timestamps the gateway may serialise", () => {
    expect(utcDays("2026-10-13T00:00:00.000Z", "2026-10-14")).toEqual(["2026-10-13", "2026-10-14"]);
  });
});

describe("zeroFill", () => {
  it("fills missing days with zeros and keeps real rows", () => {
    const filled = zeroFill(
      [{ date: "2026-10-02T00:00:00.000Z", requests: 5, errors: 1, avgResponseTimeMs: 40 }],
      "2026-10-01",
      "2026-10-03",
    );
    expect(filled).toEqual([
      { date: "2026-10-01", requests: 0, errors: 0, avgResponseTimeMs: 0 },
      { date: "2026-10-02", requests: 5, errors: 1, avgResponseTimeMs: 40 },
      { date: "2026-10-03", requests: 0, errors: 0, avgResponseTimeMs: 0 },
    ]);
  });
});

describe("formatDay", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("formats in UTC, so a viewer west of UTC sees the same day", () => {
    vi.stubEnv("TZ", "America/Los_Angeles");
    const instant = Date.UTC(2026, 9, 1);
    const options = { year: "numeric", month: "long", day: "numeric" } as const;
    // The old chart printed the UTC-midnight instant in local time: September 30 in Los Angeles.
    expect(formatDay("2026-10-01", "long")).toBe(new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(instant));
    expect(formatDay("2026-10-01", "long")).not.toBe(new Intl.DateTimeFormat(undefined, options).format(instant));
  });
});

describe("validateUsageSearch", () => {
  it("keeps supported periods and UUID key ids", () => {
    expect(validateUsageSearch({ days: 7, keyId: KEY })).toEqual({ days: 7, keyId: KEY });
    expect(validateUsageSearch({ days: "90" })).toEqual({ days: 90 });
  });

  it("drops the default period, unsupported periods, and malformed key ids", () => {
    expect(validateUsageSearch({ days: 30 })).toEqual({});
    expect(validateUsageSearch({ days: 365, keyId: "not-a-key" })).toEqual({});
    expect(validateUsageSearch({ keyId: "' OR 1=1 --" })).toEqual({});
  });
});

describe("usageHref", () => {
  it("omits defaults", () => {
    expect(usageHref({})).toBe("/dashboard/usage");
    expect(usageHref({ days: 30 })).toBe("/dashboard/usage");
    expect(usageHref({ days: 7, keyId: KEY })).toBe(`/dashboard/usage?days=7&keyId=${KEY}`);
  });
});
