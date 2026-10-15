import { describe, expect, it, vi } from "vitest";
import { UsageBuffer, type UsageEntry } from "../../src/middleware/usage-logger.js";

const entry = (i: number): UsageEntry => ({
  apiKeyId: "k",
  userId: "u",
  method: "GET",
  path: `/v1/x/${i}`,
  statusCode: 200,
  responseTimeMs: 5,
  userAgent: null,
  ipAddress: null,
  createdAt: new Date(0),
});

describe("UsageBuffer", () => {
  it("writes in batches instead of one row at a time", async () => {
    const sink = vi.fn(async () => {});
    const buf = new UsageBuffer(sink, 3, 0);
    for (let i = 0; i < 7; i++) buf.push(entry(i));
    await buf.flush();
    expect(sink.mock.calls.map((c) => (c as unknown as [UsageEntry[]])[0].length)).toEqual([3, 3, 1]);
    expect(buf.pending).toBe(0);
  });

  it("requeues rows when the database write fails", async () => {
    const sink = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValue(undefined);
    const buf = new UsageBuffer(sink, 10, 0);
    buf.push(entry(1));
    buf.push(entry(2));
    await buf.flush();
    expect(buf.pending).toBe(2);
    await buf.flush();
    expect(buf.pending).toBe(0);
    expect(sink).toHaveBeenCalledTimes(2);
  });

  it("caps memory during a long outage by dropping the oldest rows", async () => {
    const sink = vi.fn().mockRejectedValue(new Error("db down"));
    const buf = new UsageBuffer(sink, 1000, 0, 5);
    for (let i = 0; i < 8; i++) buf.push(entry(i));
    expect(buf.pending).toBe(5);
  });

  it("flushes everything on stop", async () => {
    const sink = vi.fn(async () => {});
    const buf = new UsageBuffer(sink, 100, 0);
    buf.push(entry(1));
    await buf.stop();
    expect(sink).toHaveBeenCalledOnce();
  });
});
