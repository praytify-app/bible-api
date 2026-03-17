import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { bearer } from "better-auth/plugins";
import { db } from "../db/client.js";

const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
};

/**
 * BetterAuth server instance configured with:
 * - GitHub + Google social login
 * - Bearer token plugin (for API key-like token auth)
 * - Drizzle ORM adapter for Postgres
 *
 * Note: BetterAuth does not ship an API key plugin out of the box.
 * We use the bearer plugin for token-based auth and implement
 * custom API key management via our own routes (src/routes/keys.ts).
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders,
  plugins: [bearer()],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    process.env.PORTAL_URL || "http://localhost:5173",
    process.env.BETTER_AUTH_URL || "http://localhost:3200",
  ],
});

export type Auth = typeof auth;
