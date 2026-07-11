import type { Context, Next } from "hono";
import { createHash } from "crypto";

/**
 * Extract an API key from the Authorization header.
 * Expects format: "Bearer <key>"
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

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Hono middleware that validates API keys from the Authorization header.
 * Checks the key hash against platform.api_keys table.
 */
export async function apiKeyMiddleware(c: Context, next: Next) {
  const authorization = c.req.header("Authorization");
  const apiKey = extractApiKey(authorization);

  if (!apiKey) {
    return c.json(
      {
        error: "Unauthorized",
        message:
          "Missing or invalid API key. Provide 'Authorization: Bearer <your_api_key>' header.",
      },
      401
    );
  }

  // Master key bypass — internal apps (Praytify mobile/web) use this
  const MASTER_KEY = process.env.MASTER_API_KEY;
  if (MASTER_KEY && apiKey === MASTER_KEY) {
    c.set("apiKeyId", "master");
    c.set("userId", "internal");
    await next();
    return;
  }

  try {
    const { client } = await import("../db/client.js");
    const keyHash = hashKey(apiKey);

    const rows = await client`
      SELECT id, user_id FROM platform.api_keys
      WHERE key_hash = ${keyHash} AND revoked = false
      LIMIT 1
    `;

    if (rows.length === 0) {
      return c.json(
        { error: "Unauthorized", message: "Invalid or revoked API key." },
        401
      );
    }

    c.set("apiKeyId", rows[0].id);
    c.set("userId", rows[0].user_id);

    // Fire-and-forget so key lookup latency doesn't grow with a write
    client`
      UPDATE platform.api_keys SET last_used_at = NOW() WHERE id = ${rows[0].id}
    `.catch(() => {});
  } catch (err) {
    console.error("[api-key] Validation error:", err);
    return c.json(
      { error: "Unauthorized", message: "API key validation failed." },
      401
    );
  }

  await next();
}
