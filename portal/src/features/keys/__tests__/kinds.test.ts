import { describe, expect, it } from "vitest";
import {
  KIND_INFO,
  expiresInDays,
  expiryLabel,
  expiryState,
  formatLimits,
  isExpired,
  kindOf,
  relativeTime,
  usageSnippets,
} from "../kinds";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const DAY = 86_400_000;
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("kindOf", () => {
  it("treats keys without a kind (pre ADR 0001) as secret", () => {
    expect(kindOf({})).toBe("secret");
    expect(kindOf({ kind: "secret" })).toBe("secret");
    expect(kindOf({ kind: "publishable" })).toBe("publishable");
  });

  it("documents the prefix each kind starts with", () => {
    expect(KIND_INFO.secret.prefix).toBe("pb_sk_");
    expect(KIND_INFO.publishable.prefix).toBe("pb_pk_");
  });
});

describe("expiry", () => {
  it("maps the expiry choices to days", () => {
    expect(expiresInDays("never")).toBeUndefined();
    expect(expiresInDays("30")).toBe(30);
    expect(expiresInDays("365")).toBe(365);
  });

  it("classifies never, expired, soon, and active", () => {
    expect(expiryState(null, NOW)).toEqual({ state: "never" });
    expect(expiryState(iso(-1), NOW)).toEqual({ state: "expired" });
    expect(expiryState(iso(0), NOW)).toEqual({ state: "expired" });
    expect(expiryState(iso(3 * DAY), NOW)).toEqual({ state: "soon", days: 3 });
    expect(expiryState(iso(14 * DAY), NOW)).toEqual({ state: "soon", days: 14 });
    expect(expiryState(iso(15 * DAY), NOW)).toEqual({ state: "active", days: 15 });
  });

  it("rounds a partial day up so a key never reads as expiring in 0 days", () => {
    expect(expiryState(iso(60_000), NOW)).toEqual({ state: "soon", days: 1 });
    expect(expiryLabel(expiryState(iso(60_000), NOW))).toBe("Expires in 1 day");
  });

  it("labels each state", () => {
    expect(expiryLabel({ state: "never" })).toBe("Never");
    expect(expiryLabel({ state: "expired" })).toBe("Expired");
    expect(expiryLabel({ state: "active", days: 90 })).toBe("Expires in 90 days");
  });

  it("isExpired matches the expired state", () => {
    expect(isExpired({ expiresAt: iso(-DAY) }, NOW)).toBe(true);
    expect(isExpired({ expiresAt: null }, NOW)).toBe(false);
  });
});

describe("relativeTime", () => {
  it("reads recent times naturally", () => {
    expect(relativeTime(iso(-10_000), NOW, "en")).toBe("just now");
    expect(relativeTime(iso(-5 * 60_000), NOW, "en")).toBe("5 minutes ago");
    expect(relativeTime(iso(-3 * 3_600_000), NOW, "en")).toBe("3 hours ago");
    expect(relativeTime(iso(-DAY), NOW, "en")).toBe("yesterday");
    expect(relativeTime(iso(-14 * DAY), NOW, "en")).toBe("2 weeks ago");
  });

  it("does not invent a time for bad input", () => {
    expect(relativeTime("not a date", NOW, "en")).toBe("Unknown");
  });
});

describe("formatLimits", () => {
  it("formats the plan's numbers, or nothing when the plan is missing", () => {
    expect(formatLimits({ perMinute: 60, perDay: 10000 }, "en")).toBe("60 requests a minute, 10,000 a day");
    expect(formatLimits(undefined)).toBeUndefined();
  });
});

describe("usageSnippets", () => {
  const api = "http://localhost:3200";

  it("gives server examples for secret keys with the key in the Authorization header", () => {
    const snippets = usageSnippets("secret", "pb_sk_abc", api);
    expect(snippets.map((s) => s.label)).toEqual(["curl", "Node.js"]);
    expect(snippets[0]!.code).toContain(`curl "${api}/v1/search?q=love&version=WEB"`);
    expect(snippets[0]!.code).toContain('-H "Authorization: Bearer pb_sk_abc"');
  });

  it("gives browser code for publishable keys and names the allowed origins", () => {
    const [snippet] = usageSnippets("publishable", "pb_pk_xyz", api, ["https://example.org"]);
    expect(snippet!.label).toBe("Browser");
    expect(snippet!.code).toContain("on https://example.org");
    expect(snippet!.code).toContain("403");
    expect(snippet!.code).toContain('Authorization: "Bearer pb_pk_xyz"');
  });
});
