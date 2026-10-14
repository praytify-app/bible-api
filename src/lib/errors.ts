import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * The single error envelope for everything the gateway itself returns. It
 * matches the engine's `{ error: { code, message } }`, so clients parse one
 * shape whether a request failed at the gateway or upstream.
 */
export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  headers?: Record<string, string>
): Response {
  return c.json({ error: { code, message } }, status, headers);
}
