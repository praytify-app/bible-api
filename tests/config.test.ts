import { describe, expect, it } from "vitest";
import { assertProductionReady, configWarnings, isLoopbackUrl, loadConfig } from "../src/config.js";

// The values docker-compose.yml falls back to when .env does not set them.
const SELF_HOST = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://bible_gateway:gateway-db-password-change-me@postgres:5432/praytify_bible",
  BETTER_AUTH_SECRET: "self-host-secret-change-me-self-host-secret",
  GATEWAY_TOKEN: "self-host-gateway-token-change-me",
  EMAIL_PASSWORD_AUTH: "true",
};
const REAL_SECRET = "a".repeat(64);

describe("self-host placeholders", () => {
  it("boot on localhost with a warning for each placeholder", () => {
    const cfg = loadConfig({ ...SELF_HOST, BETTER_AUTH_URL: "http://localhost:3200" });
    expect(() => assertProductionReady(cfg)).not.toThrow();
    const warnings = configWarnings(cfg).join("\n");
    expect(warnings).toContain("BETTER_AUTH_SECRET and GATEWAY_TOKEN use public placeholders");
    expect(warnings).toContain("DATABASE_URL password is a public placeholder");
  });

  it("refuse to start once the gateway is served beyond localhost", () => {
    const cfg = loadConfig({ ...SELF_HOST, BETTER_AUTH_URL: "https://bible.example.org" });
    expect(() => assertProductionReady(cfg)).toThrow(/BETTER_AUTH_SECRET and GATEWAY_TOKEN still use their public/);
  });

  it("count PUBLIC_API_URL as being served publicly too", () => {
    const cfg = loadConfig({ ...SELF_HOST, PUBLIC_API_URL: "https://api.example.org" });
    expect(() => assertProductionReady(cfg)).toThrow(/Refusing to start/);
  });

  it("name only the secret that is still a placeholder", () => {
    const cfg = loadConfig({ ...SELF_HOST, GATEWAY_TOKEN: REAL_SECRET, BETTER_AUTH_URL: "https://bible.example.org" });
    expect(() => assertProductionReady(cfg)).toThrow(/BETTER_AUTH_SECRET still uses its public/);
  });

  it("let a public gateway start once both secrets are real, warning only about the database password", () => {
    const cfg = loadConfig({
      ...SELF_HOST,
      BETTER_AUTH_SECRET: REAL_SECRET,
      GATEWAY_TOKEN: REAL_SECRET,
      BETTER_AUTH_URL: "https://bible.example.org",
    });
    expect(() => assertProductionReady(cfg)).not.toThrow();
    const warnings = configWarnings(cfg);
    expect(warnings.some((w) => w.includes("use public placeholders"))).toBe(false);
    expect(warnings.some((w) => w.includes("DATABASE_URL password"))).toBe(true);
  });
});

describe("isLoopbackUrl", () => {
  it.each([
    ["http://localhost:3200", true],
    ["http://api.localhost", true],
    ["http://127.0.0.1:3200", true],
    ["http://[::1]:3200", true],
    ["https://api.praytify.bible", false],
    ["http://192.168.1.20:3200", false],
    ["http://localhost.example.com", false],
  ])("%s -> %s", (url, expected) => {
    expect(isLoopbackUrl(url)).toBe(expected);
  });
});
