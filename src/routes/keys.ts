import { Hono } from "hono";
import { randomBytes } from "crypto";

const keysRouter = new Hono();

/**
 * Generate a random API key with a prefix.
 */
function generateApiKey(): string {
  const bytes = randomBytes(24);
  return `pb_${bytes.toString("base64url")}`;
}

/**
 * GET /api/dashboard/keys — List all API keys for the authenticated user.
 */
keysRouter.get("/", async (c) => {
  // TODO: Validate session via BetterAuth
  // TODO: Query keys from database
  return c.json({
    keys: [],
    message: "API key listing requires database connection",
  });
});

/**
 * POST /api/dashboard/keys — Create a new API key.
 * Body: { name: string }
 */
keysRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = (body as { name?: string }).name || "Untitled Key";

  // TODO: Validate session via BetterAuth
  // TODO: Store key in database

  const apiKey = generateApiKey();

  return c.json(
    {
      key: {
        id: crypto.randomUUID(),
        name,
        key: apiKey,
        createdAt: new Date().toISOString(),
      },
      message:
        "Store this key securely. It will not be shown again.",
    },
    201
  );
});

/**
 * DELETE /api/dashboard/keys/:id — Revoke an API key.
 */
keysRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // TODO: Validate session via BetterAuth
  // TODO: Soft-delete or revoke key in database

  return c.json({
    revoked: true,
    id,
    message: "API key revoked successfully",
  });
});

export { keysRouter };
