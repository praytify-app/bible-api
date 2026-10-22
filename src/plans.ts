import type { KeyKind } from "./lib/api-keys.js";

export type Tier = "free" | "partner" | "internal";

export interface Limits {
  perMinute: number;
  perDay: number;
}

/**
 * Quotas are per account, per key kind, summed across all of that account's
 * keys. Per-key quotas let anyone multiply their allowance by minting keys.
 * Secret and publishable budgets are separate so a busy embed cannot starve
 * the owner's own server traffic.
 *
 * These numbers are the product's published limits: the portal renders them
 * from GET /api/dashboard/plan, so changing them here changes the copy too.
 */
export const PLAN_LIMITS: Record<Tier, Record<KeyKind, Limits>> = {
  free: {
    secret: { perMinute: 60, perDay: 1_000 },
    publishable: { perMinute: 60, perDay: 1_000 },
  },
  partner: {
    secret: { perMinute: 600, perDay: 100_000 },
    publishable: { perMinute: 600, perDay: 100_000 },
  },
  internal: {
    secret: { perMinute: 6_000, perDay: 5_000_000 },
    publishable: { perMinute: 6_000, perDay: 5_000_000 },
  },
};

export function normalizeTier(value: unknown): Tier {
  return value === "partner" || value === "internal" ? value : "free";
}

export function limitsFor(tier: Tier, kind: KeyKind): Limits {
  return PLAN_LIMITS[tier][kind];
}

/**
 * The most of a publishable budget one client (one IP, or one IPv6 /64) can
 * use. A publishable key ships inside a web page, so every visitor of that
 * site shares the account's budget, and anyone can copy the key and forge a
 * matching Origin from a script. Without a per-client cap, one client could
 * spend the whole allowance and switch the feature off for everyone else.
 */
export const PUBLISHABLE_CLIENT_SHARE = { perMinute: 0.25, perDay: 0.1 } as const;

export function publishableClientLimits(account: Limits): Limits {
  return {
    perMinute: Math.max(1, Math.ceil(account.perMinute * PUBLISHABLE_CLIENT_SHARE.perMinute)),
    perDay: Math.max(1, Math.ceil(account.perDay * PUBLISHABLE_CLIENT_SHARE.perDay)),
  };
}
