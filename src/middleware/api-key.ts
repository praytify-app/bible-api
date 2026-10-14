import type { Context, Next } from "hono";
import type { KeyKind } from "../lib/api-keys.js";
import { extractBearer, hashApiKey, originAllowed, requestOrigin, safeEqual } from "../lib/api-keys.js";
import { clientIp } from "../lib/client-ip.js";
import { apiError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { LruCache } from "../lib/lru.js";
import type { Tier } from "../plans.js";
import { normalizeTier } from "../plans.js";
import type { GatewayEnv } from "../types.js";

export interface ResolvedKey {
  id: string;
  userId: string;
  kind: KeyKind;
  tier: Tier;
  allowedOrigins: string[];
  expiresAt: Date | null;
  revoked: boolean;
}

export type KeyLookup = (keyHash: string) => Promise<ResolvedKey | null>;

/** Reads a key, its owner's tier, and its restrictions in one query. */
export async function dbKeyLookup(keyHash: string): Promise<ResolvedKey | null> {
  const { client } = await import("../db/client.js");
  const rows = await client`
    SELECT k.id, k.user_id, k.kind, k.allowed_origins, k.expires_at, k.revoked,
           COALESCE(p.tier, 'free') AS tier
    FROM platform.api_keys k
    LEFT JOIN platform.developer_profiles p ON p.user_id = k.user_id
    WHERE k.key_hash = ${keyHash}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind === "publishable" ? "publishable" : "secret",
    tier: normalizeTier(r.tier),
    allowedOrigins: r.allowed_origins ?? [],
    expiresAt: r.expires_at ? new Date(r.expires_at) : null,
    revoked: Boolean(r.revoked),
  };
}

const NOT_FOUND = Symbol("not-found");

/**
 * Caches key lookups so a hot key costs no database read. Unknown keys are
 * cached briefly too, so a client hammering with a bad key cannot turn into a
 * database load test. Revocation through the dashboard invalidates the entry on
 * this replica immediately; other replicas see it within the TTL.
 */
export class KeyResolver {
  private cache: LruCache<ResolvedKey | typeof NOT_FOUND>;

  constructor(
    private readonly lookup: KeyLookup,
    private readonly ttlMs: number,
    private readonly negativeTtlMs = Math.min(ttlMs, 10_000)
  ) {
    // Entries are tiny; bound by count via a nominal size of 1.
    this.cache = new LruCache(50_000, () => 1);
  }

  async resolve(keyHash: string): Promise<ResolvedKey | null> {
    const hit = this.cache.get(keyHash);
    if (hit !== undefined) return hit === NOT_FOUND ? null : hit;
    const found = await this.lookup(keyHash);
    this.cache.set(keyHash, found ?? NOT_FOUND, found ? this.ttlMs : this.negativeTtlMs);
    return found;
  }

  invalidateKeyId(keyId: string): void {
    this.cache.deleteWhere((v) => v !== NOT_FOUND && v.id === keyId);
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Writes last_used_at at most once per interval per key instead of on every request. */
export class LastUsedTracker {
  private last = new Map<string, number>();

  constructor(
    private readonly write: (keyId: string) => Promise<unknown>,
    private readonly intervalMs = 60_000
  ) {}

  touch(keyId: string, now = Date.now()): void {
    const prev = this.last.get(keyId);
    if (prev !== undefined && now - prev < this.intervalMs) return;
    this.last.set(keyId, now);
    if (this.last.size > 100_000) this.last.clear();
    this.write(keyId).catch((err) => log.warn("last_used_at update failed", { err, keyId }));
  }
}

export async function dbTouchKey(keyId: string): Promise<void> {
  const { client } = await import("../db/client.js");
  await client`UPDATE platform.api_keys SET last_used_at = NOW() WHERE id = ${keyId}`;
}

export interface ApiKeyAuthOptions {
  resolver: KeyResolver;
  lastUsed: LastUsedTracker;
  masterKey?: string;
  trustedHops: number;
  /** When false, a request without Authorization proceeds as anonymous. */
  required: boolean;
}

const READ_METHODS = new Set(["GET", "HEAD"]);

export function apiKeyAuth(opts: ApiKeyAuthOptions) {
  return async (c: Context<GatewayEnv>, next: Next) => {
    const ip = clientIp(c, opts.trustedHops);
    const header = c.req.header("authorization");

    if (!header) {
      if (opts.required) {
        return apiError(
          c,
          401,
          "API_KEY_REQUIRED",
          "This endpoint needs an API key. Send 'Authorization: Bearer <key>'. Create one at https://praytify.bible/dashboard/keys."
        );
      }
      c.set("auth", { type: "anonymous", ip });
      return next();
    }

    const token = extractBearer(header);
    if (!token) {
      return apiError(c, 401, "INVALID_AUTHORIZATION", "Expected 'Authorization: Bearer <key>'.");
    }

    if (opts.masterKey && safeEqual(token, opts.masterKey)) {
      c.set("auth", { type: "master", ip });
      return next();
    }

    let key: ResolvedKey | null;
    try {
      key = await opts.resolver.resolve(hashApiKey(token));
    } catch (err) {
      // A database failure is our outage, not the caller's bad key. Reporting
      // it as 401 is how the July 2026 outage hid behind "invalid key".
      log.error("api key lookup failed", { err });
      return apiError(c, 503, "AUTH_UNAVAILABLE", "Key validation is temporarily unavailable. Please retry shortly.", {
        "Retry-After": "5",
      });
    }

    if (!key || key.revoked) {
      return apiError(c, 401, "INVALID_API_KEY", "This API key is invalid or has been revoked.");
    }
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
      return apiError(c, 401, "API_KEY_EXPIRED", "This API key has expired. Roll it in the dashboard to get a new one.");
    }

    if (key.kind === "publishable") {
      if (!READ_METHODS.has(c.req.method)) {
        return apiError(c, 403, "READ_ONLY_KEY", "Publishable keys can only make GET requests.");
      }
      if (/\/download\/?$/.test(c.req.path)) {
        return apiError(c, 403, "SECRET_KEY_REQUIRED", "Full-Bible downloads need a secret key from a server.");
      }
      const origin = requestOrigin({ origin: c.req.header("origin"), referer: c.req.header("referer") });
      if (!originAllowed(origin, key.allowedOrigins)) {
        return apiError(
          c,
          403,
          "ORIGIN_NOT_ALLOWED",
          origin
            ? `This publishable key is not allowed on ${origin}. Add the origin to the key in the dashboard.`
            : "Publishable keys only work from a browser on an allowed origin. Use a secret key on servers."
        );
      }
    }

    c.set("auth", { type: "key", ip, keyId: key.id, userId: key.userId, kind: key.kind, tier: key.tier });
    opts.lastUsed.touch(key.id);
    return next();
  };
}
