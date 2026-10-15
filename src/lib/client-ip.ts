import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

/**
 * The client's IP, resistant to spoofing.
 *
 * Each trusted reverse proxy appends the address it saw to X-Forwarded-For,
 * so with N trusted hops the real client is the Nth entry from the right.
 * Everything to the left of that was supplied by the client and is ignored.
 * With 0 hops only the socket address is trusted.
 */
export function clientIp(c: Context, trustedHops: number): string | null {
  if (trustedHops > 0) {
    const xff = c.req.header("x-forwarded-for");
    if (xff) {
      const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
      const idx = parts.length - trustedHops;
      if (idx >= 0 && parts[idx]) return parts[idx];
    }
  }
  try {
    return getConnInfo(c).remote.address ?? null;
  } catch {
    // Not running on the Node adapter (unit tests use app.request()).
    return null;
  }
}
