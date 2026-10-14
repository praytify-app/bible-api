import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { config } from "../config.js";
import { db } from "../db/client.js";

const cfg = config();

const socialProviders = {
  ...(cfg.GITHUB_CLIENT_ID && cfg.GITHUB_CLIENT_SECRET
    ? { github: { clientId: cfg.GITHUB_CLIENT_ID, clientSecret: cfg.GITHUB_CLIENT_SECRET } }
    : {}),
  ...(cfg.GOOGLE_CLIENT_ID && cfg.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: cfg.GOOGLE_CLIENT_ID, clientSecret: cfg.GOOGLE_CLIENT_SECRET } }
    : {}),
};

/**
 * Developer accounts: GitHub and Google OAuth with database sessions.
 *
 * API keys are not a BetterAuth concern; they live in platform.api_keys and
 * are checked by middleware/api-key.ts. The bearer() plugin is intentionally
 * absent: nothing here needs a session token to double as a credential.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  socialProviders,
  secret: cfg.BETTER_AUTH_SECRET,
  baseURL: cfg.BETTER_AUTH_URL,
  trustedOrigins: [...cfg.PORTAL_URL, cfg.BETTER_AUTH_URL],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    useSecureCookies: cfg.NODE_ENV === "production",
  },
});

export type Auth = typeof auth;
