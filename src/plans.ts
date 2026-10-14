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
