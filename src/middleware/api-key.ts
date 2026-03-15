import type { Context, Next } from "hono";

/**
 * Extract an API key from the Authorization header.
 * Expects format: "Bearer <key>"
 *
 * Returns the key string or null if not valid.
 */
export function extractApiKey(
  authorizationHeader: string | undefined
): string | null {
  if (!authorizationHeader) return null;

  const parts = authorizationHeader.split(" ");
  if (parts.length !== 2) return null;
  if (parts[0] !== "Bearer") return null;

  const key = parts[1];
  if (!key || key.trim() === "") return null;

  return key;
}

/**
 * Hono middleware that validates API keys from the Authorization header.
 *
 * On success, sets `c.set("apiKeyId", ...)` and `c.set("userId", ...)`
 * for downstream handlers.
 *
 * In production this would validate against a database table.
 * For now, it extracts and validates format only.
 */
export async function apiKeyMiddleware(c: Context, next: Next) {
  const authorization = c.req.header("Authorization");
  const apiKey = extractApiKey(authorization);

  if (!apiKey) {
    return c.json(
      {
        error: "Unauthorized",
        message:
          "Missing or invalid API key. Provide a Bearer token in the Authorization header.",
      },
      401
    );
  }

  // TODO: Validate API key against database and resolve userId
  // For now, set the raw key as both apiKeyId and userId
  c.set("apiKeyId", apiKey);
  c.set("userId", apiKey);

  await next();
}
