import { Hono } from "hono";
import { apiError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { PLAN_LIMITS } from "../plans.js";
import type { GatewayEnv } from "../types.js";

/** Routes that need an API key. Everything else under /v1 is public. */
export const KEYED_PATHS = [/^\/v1\/search$/, /^\/v1\/versions\/[^/]+\/download$/];

// Engine-internal routes that must never appear in the public reference.
const HIDDEN_PATHS = [/\/admin(\/|$)/, /\/esv\//, /\/health$/];

// Pinned file plus Subresource Integrity: a compromised CDN cannot change the
// code this page runs. Bump both together.
const SCALAR_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.74.0/dist/browser/standalone.js";
const SCALAR_SRI = "sha384-VXnKAz61Xwc3tbw1P+KKrUP7YbcsSl1Ik4is5UnogJyw9XEYZ5Ay/T1i0zPYtSZH";

type OpenApiDoc = {
  openapi?: string;
  info?: Record<string, unknown>;
  servers?: unknown[];
  paths?: Record<string, Record<string, Record<string, unknown>>>;
  components?: Record<string, unknown>;
  security?: unknown[];
  [k: string]: unknown;
};

const DESCRIPTION = `
Scripture in 1,200+ translations over a plain JSON API.

**No key needed** to read the catalog, chapters, references (\`/v1/verses?ref=\`), or the daily verse. Anonymous requests share a per-IP limit.

**A key unlocks** search and full-Bible downloads, and moves you onto a per-account quota. Create one at https://praytify.bible/dashboard/keys:
- \`pb_sk_…\` secret keys are for servers.
- \`pb_pk_…\` publishable keys are safe in browsers on the origins you allow, and are read-only.

Send keys as \`Authorization: Bearer <key>\`. Every response carries \`X-RateLimit-*\` headers; a \`429\` includes \`Retry-After\`.

Free plan: ${PLAN_LIMITS.free.secret.perMinute} requests per minute and ${PLAN_LIMITS.free.secret.perDay.toLocaleString("en-US")} per day per key kind, per account.

Scripture responses are cacheable: honour \`ETag\` and \`Cache-Control\`.
`.trim();

/**
 * The engine documents its internal surface (`/api/v1`). The public contract is
 * the gateway's (`/v1`, bearer keys, public versus keyed routes), so the
 * gateway publishes its own rewrite of the engine's spec.
 */
export function toPublicSpec(engine: OpenApiDoc, publicUrl: string): OpenApiDoc {
  const paths: NonNullable<OpenApiDoc["paths"]> = {};
  for (const [path, item] of Object.entries(engine.paths ?? {})) {
    if (HIDDEN_PATHS.some((re) => re.test(path))) continue;
    const publicPath = path.replace(/^\/api\/v1(?=\/|$)/, "/v1");
    if (!publicPath.startsWith("/v1")) continue;
    // OpenAPI templates `{id}`; compare against a concrete-looking path.
    const probe = publicPath.replace(/\{[^}]+\}/g, "x");
    const keyed = KEYED_PATHS.some((re) => re.test(probe));
    const ops: Record<string, Record<string, unknown>> = {};
    for (const [method, op] of Object.entries(item)) {
      if (typeof op !== "object" || op === null) continue;
      ops[method] = {
        ...op,
        security: keyed ? [{ bearerAuth: [] }] : [{}, { bearerAuth: [] }],
        description: [op.description, keyed ? "Requires an API key." : "No key required; a key gives you your account quota."]
          .filter(Boolean)
          .join("\n\n"),
      };
    }
    paths[publicPath] = ops;
  }
  const components = (engine.components ?? {}) as Record<string, unknown>;
  return {
    ...engine,
    info: { ...(engine.info ?? {}), title: "Praytify Bible API", description: DESCRIPTION },
    servers: [{ url: publicUrl.replace(/\/+$/, ""), description: "Praytify Bible gateway" }],
    paths,
    components: {
      ...components,
      securitySchemes: {
        ...((components.securitySchemes as Record<string, unknown>) ?? {}),
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "A pb_sk_ secret key (servers) or pb_pk_ publishable key (allowed browser origins).",
        },
      },
    },
  };
}

export function docsRouter(opts: { engineUrl: string; publicUrl: string; gatewayToken?: string }) {
  const router = new Hono<GatewayEnv>();
  let cached: { spec: OpenApiDoc; at: number } | null = null;
  const TTL = 10 * 60_000;

  router.get("/v1/openapi.json", async (c) => {
    if (!cached || Date.now() - cached.at > TTL) {
      try {
        const res = await fetch(`${opts.engineUrl}/api/v1/openapi.json`, {
          headers: opts.gatewayToken ? { "x-gateway-token": opts.gatewayToken } : {},
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`engine returned ${res.status}`);
        cached = { spec: toPublicSpec((await res.json()) as OpenApiDoc, opts.publicUrl), at: Date.now() };
      } catch (err) {
        log.error("openapi fetch failed", { err });
        if (!cached) return apiError(c, 502, "SPEC_UNAVAILABLE", "The API reference is temporarily unavailable.");
      }
    }
    return c.json(cached!.spec, 200, { "cache-control": "public, max-age=600" });
  });

  router.get("/docs", (c) => {
    c.header("cache-control", "public, max-age=600");
    // The page CSP is set in app.ts alongside the other security headers.
    return c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Praytify Bible API reference</title>
  <meta name="description" content="Reference for the Praytify Bible API: 1,200+ translations, chapters, references, search, and the daily verse.">
</head>
<body>
  <script id="api-reference" data-url="/v1/openapi.json"></script>
  <script src="${SCALAR_SRC}" integrity="${SCALAR_SRI}" crossorigin="anonymous"></script>
</body>
</html>`);
  });

  return router;
}
