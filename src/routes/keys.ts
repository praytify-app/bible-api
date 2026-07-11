import { Hono } from "hono";
import { randomBytes, createHash } from "crypto";
import { client } from "../db/client.js";
import { getSessionUser } from "../lib/session.js";

const keysRouter = new Hono();

function generateApiKey(): string {
  const bytes = randomBytes(24);
  return `pb_${bytes.toString("base64url")}`;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// List keys
keysRouter.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const rows = await client`
    SELECT id, name, key_prefix, created_at, last_used_at, revoked
    FROM platform.api_keys
    WHERE user_id = ${user.id} AND revoked = false
    ORDER BY created_at DESC
  `;

  return c.json({
    keys: rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      prefix: r.key_prefix,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
    })),
  });
});

// Create key
keysRouter.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const name = (body as { name?: string }).name || "Untitled Key";

  const apiKey = generateApiKey();
  const keyHash = hashKey(apiKey);
  const keyPrefix = apiKey.substring(0, 10) + "...";
  const id = crypto.randomUUID();

  await client`
    INSERT INTO platform.api_keys (id, user_id, name, key_hash, key_prefix, created_at)
    VALUES (${id}, ${user.id}, ${name}, ${keyHash}, ${keyPrefix}, NOW())
  `;

  return c.json(
    {
      key: {
        id,
        name,
        key: apiKey,
        prefix: keyPrefix,
        createdAt: new Date().toISOString(),
      },
      message: "Store this key securely. It will not be shown again.",
    },
    201
  );
});

// Revoke key
keysRouter.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");

  await client`
    UPDATE platform.api_keys
    SET revoked = true
    WHERE id = ${id} AND user_id = ${user.id}
  `;

  return c.json({ revoked: true, id });
});

export { keysRouter };
