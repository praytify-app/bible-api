import { describe, it, expect } from "vitest";
import { extractApiKey } from "../../src/middleware/api-key.js";

describe("extractApiKey", () => {
  it('extracts key from "Bearer abc123"', () => {
    expect(extractApiKey("Bearer abc123")).toBe("abc123");
  });

  it("returns null for undefined", () => {
    expect(extractApiKey(undefined)).toBeNull();
  });

  it('returns null for "Basic abc123"', () => {
    expect(extractApiKey("Basic abc123")).toBeNull();
  });

  it('returns null for "Bearer " (empty key)', () => {
    expect(extractApiKey("Bearer ")).toBeNull();
  });

  it('returns null for "Bearer" (no space)', () => {
    expect(extractApiKey("Bearer")).toBeNull();
  });

  it("extracts long API key", () => {
    const longKey = "sk_live_abc123def456ghi789jkl012mno345";
    expect(extractApiKey(`Bearer ${longKey}`)).toBe(longKey);
  });
});
