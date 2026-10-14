import { Hono } from "hono";
import { z } from "zod";
import { client } from "../db/client.js";
import type { KeyKind } from "../lib/api-keys.js";
import { displayPrefix, generateApiKey, hashApiKey, normalizeOriginPattern } from "../lib/api-keys.js";
import { apiError } from "../lib/errors.js";
import type { DashboardEnv } from "../lib/session.js";
import { requireSession } from "../lib/session.js";
import { normalizeTier } from "../plans.js";

const MAX_ORIGINS = 20;

const originsSchema = z
  .array(z.string().max(253))
  .max(MAX_ORIGINS, `At most ${MAX_ORIGINS} origins per key`)
  .transform((list, ctx) => {
    const out = new Set<string>();
    for (const raw of list) {
      const r = normalizeOriginPattern(raw);
      if ("error" in r) {
        ctx.addIssue({ code: "custom", message: r.error });
        return z.NEVER;
      }
      out.add(r.pattern);
    }
    return [...out];
  });

const nameSchema = z.string().trim().min(1, "Name the key").max(80, "Keep the name under 80 characters");

const createSchema = z
  .object({
    name: nameSchema.optional(),
    kind: z.enum(["secret", "publishable"]).default("secret"),
    allowedOrigins: originsSchema.optional(),
    expiresInDays: z.number().int().min(1).max(730).optional(),
  })
  .refine((b) => b.kind !== "publishable" || (b.allowedOrigins?.length ?? 0) > 0, {
    message: "Publishable keys need at least one allowed origin, e.g. https://example.org",
    path: ["allowedOrigins"],
  });

const patchSchema = z
  .object({ name: nameSchema.optional(), allowedOrigins: originsSchema.optional() })
  .refine((b) => b.name !== undefined || b.allowedOrigins !== undefined, { message: "Nothing to update" });

const idSchema = z.uuid();

interface KeyRow {
  id: string;
  name: string;
  kind: string;
  key_prefix: string;
  allowed_origins: string[] | null;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
}

function toKey(r: KeyRow, tier: string) {
  return {
    id: r.id,
    name: r.name,
    kind: (r.kind === "publishable" ? "publishable" : "secret") as KeyKind,
    prefix: r.key_prefix,
    allowedOrigins: r.allowed_origins ?? [],
    tier: normalizeTier(tier),
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    expiresAt: r.expires_at,
  };
}

// postgres-js cannot serialise a Date parameter in a query that also binds an
// array helper, so timestamps go in as ISO strings with an explicit cast.
function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid request";
}

async function tierOf(userId: string): Promise<string> {
  const [p] = await client`SELECT tier FROM platform.developer_profiles WHERE user_id = ${userId} LIMIT 1`;
  return p?.tier ?? "free";
}

export interface KeysRouterOptions {
  maxKeysPerUser: number;
  /** Called after revoke, roll, or edit so the auth cache drops the old state now. */
  onKeyChanged: (keyId: string) => void;
}

export function keysRouter(opts: KeysRouterOptions) {
  const router = new Hono<DashboardEnv>();
  router.use("*", requireSession);

  router.get("/", async (c) => {
    const user = c.get("user");
    const [rows, tier] = await Promise.all([
      client<KeyRow[]>`
        SELECT id, name, kind, key_prefix, allowed_origins, created_at, last_used_at, expires_at
        FROM platform.api_keys
        WHERE user_id = ${user.id} AND revoked = false
        ORDER BY created_at DESC
      `,
      tierOf(user.id),
    ]);
    return c.json({ keys: rows.map((r) => toKey(r, tier)) });
  });

  router.post("/", async (c) => {
    const user = c.get("user");
    const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return apiError(c, 400, "INVALID_REQUEST", firstIssue(parsed.error));
    const body = parsed.data;

    const [{ count }] = await client`
      SELECT COUNT(*)::int AS count FROM platform.api_keys
      WHERE user_id = ${user.id} AND revoked = false AND (expires_at IS NULL OR expires_at > NOW())
    `;
    if (count >= opts.maxKeysPerUser) {
      return apiError(
        c,
        409,
        "KEY_LIMIT_REACHED",
        `You have ${count} active keys, the maximum. Revoke one you no longer use, or roll an existing key instead.`
      );
    }

    const plaintext = generateApiKey(body.kind);
    const expiresAt = body.expiresInDays ? new Date(Date.now() + body.expiresInDays * 86_400_000) : null;
    const origins = body.kind === "publishable" ? (body.allowedOrigins ?? []) : [];
    const [row] = await client<KeyRow[]>`
      INSERT INTO platform.api_keys (user_id, name, kind, key_hash, key_prefix, allowed_origins, expires_at)
      VALUES (${user.id}, ${body.name ?? "Untitled key"}, ${body.kind}, ${hashApiKey(plaintext)},
              ${displayPrefix(plaintext)}, ${client.array(origins)}, ${isoOrNull(expiresAt)}::timestamptz)
      RETURNING id, name, kind, key_prefix, allowed_origins, created_at, last_used_at, expires_at
    `;
    return c.json(
      {
        key: { ...toKey(row!, await tierOf(user.id)), key: plaintext },
        message: "Store this key securely. It will not be shown again.",
      },
      201
    );
  });

  router.patch("/:id", async (c) => {
    const user = c.get("user");
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return apiError(c, 400, "INVALID_ID", "That is not a key id.");
    const parsed = patchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return apiError(c, 400, "INVALID_REQUEST", firstIssue(parsed.error));

    const [existing] = await client<{ kind: string }[]>`
      SELECT kind FROM platform.api_keys WHERE id = ${id.data} AND user_id = ${user.id} AND revoked = false
    `;
    if (!existing) return apiError(c, 404, "KEY_NOT_FOUND", "No active key with that id.");
    if (parsed.data.allowedOrigins !== undefined) {
      if (existing.kind !== "publishable") {
        return apiError(c, 400, "INVALID_REQUEST", "Only publishable keys have allowed origins.");
      }
      if (parsed.data.allowedOrigins.length === 0) {
        return apiError(c, 400, "INVALID_REQUEST", "A publishable key needs at least one allowed origin.");
      }
    }

    const [row] = await client<KeyRow[]>`
      UPDATE platform.api_keys SET
        name = COALESCE(${parsed.data.name ?? null}, name),
        allowed_origins = COALESCE(${parsed.data.allowedOrigins ? client.array(parsed.data.allowedOrigins) : null}::text[], allowed_origins),
        updated_at = NOW()
      WHERE id = ${id.data} AND user_id = ${user.id}
      RETURNING id, name, kind, key_prefix, allowed_origins, created_at, last_used_at, expires_at
    `;
    opts.onKeyChanged(id.data);
    return c.json({ key: toKey(row!, await tierOf(user.id)) });
  });

  /** Replace a key in one step: same name, kind, and origins; the old key stops working immediately. */
  router.post("/:id/roll", async (c) => {
    const user = c.get("user");
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return apiError(c, 400, "INVALID_ID", "That is not a key id.");

    const result = await client.begin(async (tx) => {
      const [old] = await tx<(KeyRow & { expires_at: Date | null })[]>`
        SELECT id, name, kind, key_prefix, allowed_origins, created_at, last_used_at, expires_at
        FROM platform.api_keys WHERE id = ${id.data} AND user_id = ${user.id} AND revoked = false
        FOR UPDATE
      `;
      if (!old) return null;
      const kind: KeyKind = old.kind === "publishable" ? "publishable" : "secret";
      const plaintext = generateApiKey(kind);
      // Keep the original lifetime policy: a key that expired or was set to
      // expire gets the same duration again, measured from now.
      // Timestamps may come back as strings depending on the driver's type
      // parsing, so normalise before doing arithmetic.
      const lifetimeMs = old.expires_at ? new Date(old.expires_at).getTime() - new Date(old.created_at).getTime() : null;
      const expiresAt = lifetimeMs && lifetimeMs > 0 ? new Date(Date.now() + lifetimeMs) : null;
      await tx`UPDATE platform.api_keys SET revoked = true, updated_at = NOW() WHERE id = ${old.id}`;
      const [row] = await tx<KeyRow[]>`
        INSERT INTO platform.api_keys (user_id, name, kind, key_hash, key_prefix, allowed_origins, expires_at)
        VALUES (${user.id}, ${old.name}, ${kind}, ${hashApiKey(plaintext)}, ${displayPrefix(plaintext)},
                ${client.array(old.allowed_origins ?? [])}, ${isoOrNull(expiresAt)}::timestamptz)
        RETURNING id, name, kind, key_prefix, allowed_origins, created_at, last_used_at, expires_at
      `;
      return { row: row!, plaintext, revokedId: old.id };
    });

    if (!result) return apiError(c, 404, "KEY_NOT_FOUND", "No active key with that id.");
    opts.onKeyChanged(result.revokedId);
    return c.json(
      {
        key: { ...toKey(result.row, await tierOf(user.id)), key: result.plaintext },
        revokedId: result.revokedId,
        message: "The old key no longer works. Store this key securely. It will not be shown again.",
      },
      201
    );
  });

  router.delete("/:id", async (c) => {
    const user = c.get("user");
    const id = idSchema.safeParse(c.req.param("id"));
    if (!id.success) return apiError(c, 400, "INVALID_ID", "That is not a key id.");
    const rows = await client`
      UPDATE platform.api_keys SET revoked = true, updated_at = NOW()
      WHERE id = ${id.data} AND user_id = ${user.id} AND revoked = false
      RETURNING id
    `;
    if (rows.length === 0) return apiError(c, 404, "KEY_NOT_FOUND", "No active key with that id.");
    opts.onKeyChanged(id.data);
    return c.json({ revoked: true, id: id.data });
  });

  return router;
}
