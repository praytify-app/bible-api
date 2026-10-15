import type { Context, Next } from "hono";
import { apiError } from "./errors.js";
import { log } from "./logger.js";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface DashboardEnv {
  Variables: { user: SessionUser; requestId: string };
}

/** Authenticated user from the BetterAuth session cookie, or null. */
export async function getSessionUser(c: Context): Promise<SessionUser | null> {
  const { auth } = await import("../auth/index.js");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/** Guards every dashboard route: 401 without a session, 503 if the session store is down. */
export async function requireSession(c: Context<DashboardEnv>, next: Next) {
  let user: SessionUser | null;
  try {
    user = await getSessionUser(c);
  } catch (err) {
    log.error("session lookup failed", { err });
    return apiError(c, 503, "AUTH_UNAVAILABLE", "Sign-in is temporarily unavailable. Please retry shortly.");
  }
  if (!user) return apiError(c, 401, "UNAUTHENTICATED", "Sign in to use the dashboard.");
  c.set("user", user);
  // Dashboard responses are per-user and can contain one-time key material.
  c.header("cache-control", "no-store");
  return next();
}
