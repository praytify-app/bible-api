import { Hono } from "hono";

const profileRouter = new Hono();

/**
 * GET /api/dashboard/profile — Get the authenticated developer's profile.
 */
profileRouter.get("/", async (c) => {
  // TODO: Validate session via BetterAuth
  // TODO: Query developer_profiles from database

  return c.json({
    profile: null,
    message: "Profile retrieval requires database connection",
  });
});

/**
 * PUT /api/dashboard/profile — Update the developer profile.
 * Body: { appName?, appUrl?, description? }
 */
profileRouter.put("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  // TODO: Validate session via BetterAuth
  // TODO: Upsert developer_profiles in database

  const { appName, appUrl, description } = body as {
    appName?: string;
    appUrl?: string;
    description?: string;
  };

  return c.json({
    profile: {
      appName: appName || null,
      appUrl: appUrl || null,
      description: description || null,
      tier: "free",
      updatedAt: new Date().toISOString(),
    },
    message: "Profile update requires database connection for persistence",
  });
});

export { profileRouter };
