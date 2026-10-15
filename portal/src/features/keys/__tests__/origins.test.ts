import { describe, expect, it } from "vitest";
import { MAX_ORIGINS, checkOrigin, checkOriginRows, insecureOriginWarning } from "../origins";

// Cases mirror the gateway's normalizeOriginPattern (src/lib/api-keys.ts) so the
// editor never accepts what the server rejects, or the reverse.
describe("checkOrigin", () => {
  it.each([
    ["https://example.org", "https://example.org"],
    ["  https://Example.ORG/  ", "https://example.org"],
    ["https://*.example.org", "https://*.example.org"],
    ["https://example.org:443", "https://example.org"],
    ["https://example.org:8443", "https://example.org:8443"],
    ["http://localhost:5173", "http://localhost:5173"],
    ["http://localhost:*", "http://localhost:*"],
    ["http://127.0.0.1:8080", "http://127.0.0.1:8080"],
    ["http://[::1]:3000", "http://[::1]:3000"],
    ["http://localhost:80", "http://localhost"],
  ])("accepts %s as %s", (input, pattern) => {
    expect(checkOrigin(input)).toMatchObject({ ok: true, pattern });
  });

  it.each([
    ["", /enter an origin/i],
    ["   ", /enter an origin/i],
    ["*", /bare \*/i],
    ["example.org", /scheme and host/i],
    ["https://example.org/path", /scheme and host/i],
    ["https://example.org?x=1", /scheme and host/i],
    ["ftp://example.org", /scheme and host/i],
    ["https://user@example.org", /scheme and host/i],
    ["https://*.localhost", /real domain/i],
    ["https://*.org", /real domain/i],
    ["https://example.org:*", /only works for localhost/i],
    ["https://example.org:0", /1 to 65535/],
    ["https://example.org:70000", /1 to 65535/],
    ["https://.example.org", /not valid/],
    ["https://example..org", /not valid/],
    ["https://example.org.", /not valid/],
    ["https://exa mple.org", /scheme and host/i],
  ])("rejects %j", (input, message) => {
    const result = checkOrigin(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it("accepts plain http on a real host but warns", () => {
    const result = checkOrigin("http://church.example.org");
    expect(result).toMatchObject({ ok: true, pattern: "http://church.example.org" });
    expect(result.ok && result.warning).toMatch(/unencrypted/i);
  });

  it("does not warn for https or local http", () => {
    expect(checkOrigin("https://example.org")).not.toHaveProperty("warning");
    expect(checkOrigin("http://localhost:5199")).not.toHaveProperty("warning");
    expect(checkOrigin("http://127.0.0.1:*")).not.toHaveProperty("warning");
  });
});

describe("insecureOriginWarning", () => {
  it("flags stored http patterns on real hosts, including wildcards", () => {
    expect(insecureOriginWarning("http://example.org")).toBeDefined();
    expect(insecureOriginWarning("http://*.example.org:8080")).toBeDefined();
    expect(insecureOriginWarning("http://localhost:*")).toBeUndefined();
    expect(insecureOriginWarning("http://[::1]:3000")).toBeUndefined();
    expect(insecureOriginWarning("https://example.org")).toBeUndefined();
  });
});

describe("checkOriginRows", () => {
  it("normalises and returns patterns when every row is valid", () => {
    const result = checkOriginRows(["https://a.example.org", "http://localhost:5199"]);
    expect(result.valid).toBe(true);
    expect(result.patterns).toEqual(["https://a.example.org", "http://localhost:5199"]);
    expect(result.errors).toEqual([undefined, undefined]);
  });

  it("marks a duplicate after normalisation against the first row", () => {
    const result = checkOriginRows(["https://example.org", "HTTPS://example.org:443/"]);
    expect(result.valid).toBe(false);
    expect(result.errors[1]).toMatch(/row 1/);
    expect(result.patterns).toEqual(["https://example.org"]);
  });

  it("reports each bad row in place", () => {
    const result = checkOriginRows(["https://ok.example.org", "nope", ""]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBeUndefined();
    expect(result.errors[1]).toMatch(/scheme and host/i);
    expect(result.errors[2]).toMatch(/enter an origin/i);
  });

  it("requires at least one row", () => {
    const result = checkOriginRows([]);
    expect(result.valid).toBe(false);
    expect(result.listError).toMatch(/at least one/);
  });

  it("caps the list at the gateway's maximum", () => {
    const rows = Array.from({ length: MAX_ORIGINS + 1 }, (_, i) => `https://s${i}.example.org`);
    const result = checkOriginRows(rows);
    expect(result.valid).toBe(false);
    expect(result.listError).toMatch(String(MAX_ORIGINS));
  });

  it("keeps warnings per row without failing validation", () => {
    const result = checkOriginRows(["https://example.org", "http://example.net"]);
    expect(result.valid).toBe(true);
    expect(result.warnings[0]).toBeUndefined();
    expect(result.warnings[1]).toMatch(/unencrypted/i);
  });
});
