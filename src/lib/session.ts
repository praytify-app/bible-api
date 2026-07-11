import type { Context } from "hono";
import { auth } from "../auth/index.js";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

/** Get authenticated user from BetterAuth session cookie, or null. */
export async function getSessionUser(c: Context): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) return null;
    return session.user as SessionUser;
  } catch {
    return null;
  }
}
