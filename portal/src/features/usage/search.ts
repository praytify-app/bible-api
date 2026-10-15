/** The periods the gateway keeps data for (90-day retention). */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface UsageSearch {
  days?: Period;
  keyId?: string;
}

export function isKeyId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/**
 * `validateSearch` for /dashboard/usage. Anything the gateway would reject
 * (a non-UUID key id, a period outside 7, 30, 90) is dropped here instead of
 * turning into a failed request.
 */
export function validateUsageSearch(search: Record<string, unknown>): UsageSearch {
  const out: UsageSearch = {};
  const days = Number(search.days);
  if ((PERIODS as readonly number[]).includes(days) && days !== DEFAULT_PERIOD) out.days = days as Period;
  if (isKeyId(search.keyId)) out.keyId = search.keyId;
  return out;
}

/** The URL for a usage view; defaults are left out so the plain path stays canonical. */
export function usageHref({ days, keyId }: UsageSearch): string {
  const params = new URLSearchParams();
  if (days && days !== DEFAULT_PERIOD) params.set("days", String(days));
  if (keyId) params.set("keyId", keyId);
  const query = params.toString();
  return `/dashboard/usage${query ? `?${query}` : ""}`;
}
