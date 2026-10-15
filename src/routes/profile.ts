import { Hono } from "hono";
import { z } from "zod";
import { client } from "../db/client.js";
import { apiError } from "../lib/errors.js";
import type { DashboardEnv } from "../lib/session.js";
import { requireSession } from "../lib/session.js";
import type { Limits, Tier } from "../plans.js";
import { normalizeTier, PLAN_LIMITS } from "../plans.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullable()
    .optional();

const profileSchema = z.object({
  appName: optionalText(120),
  appUrl: optionalText(300).refine((v) => v == null || /^https?:\/\/[^\s]+$/i.test(v), {
    message: "App URL must start with http:// or https://",
  }),
  description: optionalText(2000),
});

function toProfileJson(row: Record<string, unknown>) {
  return {
    appName: row.app_name ?? null,
    appUrl: row.app_url ?? null,
    description: row.description ?? null,
    tier: normalizeTier(row.tier),
    updatedAt: row.updated_at ?? null,
  };
}

export function profileRouter() {
  const router = new Hono<DashboardEnv>();
  router.use("*", requireSession);

  router.get("/", async (c) => {
    const user = c.get("user");
    const [row] = await client`
      SELECT app_name, app_url, description, tier, updated_at
      FROM platform.developer_profiles WHERE user_id = ${user.id} LIMIT 1
    `;
    return c.json({ profile: row ? toProfileJson(row) : null });
  });

  /**
   * Partial update: only fields present in the body change, so a client that
   * failed to load the profile cannot blank it by saving an empty form.
   * Tier is never client-writable.
   */
  router.put("/", async (c) => {
    const user = c.get("user");
    const parsed = profileSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return apiError(c, 400, "INVALID_REQUEST", parsed.error.issues[0]?.message ?? "Invalid profile");
    const b = parsed.data;
    const has = (k: keyof typeof b) => b[k] !== undefined;

    const [row] = await client`
      INSERT INTO platform.developer_profiles (user_id, app_name, app_url, description)
      VALUES (${user.id}, ${b.appName ?? null}, ${b.appUrl ?? null}, ${b.description ?? null})
      ON CONFLICT (user_id) DO UPDATE SET
        app_name = CASE WHEN ${has("appName")} THEN EXCLUDED.app_name ELSE platform.developer_profiles.app_name END,
        app_url = CASE WHEN ${has("appUrl")} THEN EXCLUDED.app_url ELSE platform.developer_profiles.app_url END,
        description = CASE WHEN ${has("description")} THEN EXCLUDED.description ELSE platform.developer_profiles.description END,
        updated_at = NOW()
      RETURNING app_name, app_url, description, tier, updated_at
    `;
    return c.json({ profile: toProfileJson(row!) });
  });

  return router;
}

export function planRouter(opts: { anonymous: Limits; maxKeysPerUser: number }) {
  const router = new Hono<DashboardEnv>();
  router.use("*", requireSession);
  router.get("/", async (c) => {
    const user = c.get("user");
    const [row] = await client`SELECT tier FROM platform.developer_profiles WHERE user_id = ${user.id} LIMIT 1`;
    const tier: Tier = normalizeTier(row?.tier);
    return c.json({
      tier,
      limits: { ...PLAN_LIMITS[tier], anonymous: opts.anonymous },
      maxKeys: opts.maxKeysPerUser,
      tiers: PLAN_LIMITS,
    });
  });
  return router;
}
