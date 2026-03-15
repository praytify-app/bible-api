import { Hono } from "hono";
import { auth } from "../auth/index.js";

const authRouter = new Hono();

/**
 * Forward all /api/auth/* requests to BetterAuth handler.
 * BetterAuth manages its own routing internally.
 */
authRouter.all("/*", async (c) => {
  const response = await auth.handler(c.req.raw);
  return response;
});

export { authRouter };
