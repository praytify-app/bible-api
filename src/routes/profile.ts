import { Hono } from "hono";
import { client } from "../db/client.js";
import { getSessionUser } from "../lib/session.js";

const profileRouter = new Hono();

function toProfileJson(row: any) {
  return {
    appName: row.app_name,
    appUrl: row.app_url,
    description: row.description,
    tier: row.tier,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/dashboard/profile — Get the authenticated developer's profile.
 */
profileRouter.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const rows = await client`
    SELECT app_name, app_url, description, tier, updated_at
    FROM platform.developer_profiles
    WHERE user_id = ${user.id}
    LIMIT 1
  `;

  return c.json({ profile: rows.length > 0 ? toProfileJson(rows[0]) : null });
});

/**
 * PUT /api/dashboard/profile — Upsert the developer profile.
 * Body: { appName?, appUrl?, description? }
 * Tier is intentionally not client-writable; it stays operator-controlled.
 */
profileRouter.put("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const { appName, appUrl, description } = body as {
    appName?: string;
    appUrl?: string;
    description?: string;
  };

  const rows = await client`
    INSERT INTO platform.developer_profiles (user_id, app_name, app_url, description)
    VALUES (${user.id}, ${appName ?? null}, ${appUrl ?? null}, ${description ?? null})
    ON CONFLICT (user_id) DO UPDATE
    SET app_name = EXCLUDED.app_name,
        app_url = EXCLUDED.app_url,
        description = EXCLUDED.description,
        updated_at = NOW()
    RETURNING app_name, app_url, description, tier, updated_at
  `;

  return c.json({ profile: toProfileJson(rows[0]) });
});

export { profileRouter };
