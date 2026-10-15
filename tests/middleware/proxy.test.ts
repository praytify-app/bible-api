import { describe, expect, it } from "vitest";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { brotliWindowBits } from "../../src/middleware/proxy.js";

describe("brotliWindowBits", () => {
  it("picks the smallest window that holds the body, within brotli's limits", () => {
    expect(brotliWindowBits(0)).toBe(constants.BROTLI_MIN_WINDOW_BITS);
    expect(brotliWindowBits(7_317)).toBe(13);
    // A window of n bits holds 2^n - 16 bytes.
    expect(brotliWindowBits(65_520)).toBe(16);
    expect(brotliWindowBits(65_521)).toBe(17);
    expect(brotliWindowBits(50 * 1024 * 1024)).toBe(constants.BROTLI_DEFAULT_WINDOW);
  });

  it("round-trips and compresses as well as the default window", () => {
    const verses = Array.from({ length: 3_000 }, (_, i) => ({ number: i, text: `Verse ${i}: ${"and it came to pass ".repeat((i % 5) + 1)}` }));
    const body = Buffer.from(JSON.stringify({ data: verses }));
    const quality = { [constants.BROTLI_PARAM_QUALITY]: 5 };
    const sized = brotliCompressSync(body, {
      params: { ...quality, [constants.BROTLI_PARAM_LGWIN]: brotliWindowBits(body.byteLength) },
    });
    const defaultWindow = brotliCompressSync(body, { params: quality });

    expect(brotliDecompressSync(sized).equals(body)).toBe(true);
    expect(sized.byteLength).toBeLessThanOrEqual(Math.ceil(defaultWindow.byteLength * 1.01));
  });
});
