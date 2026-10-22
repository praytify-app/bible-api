import { useQuery } from "@tanstack/react-query";
import { limits, type ClientShare, type Limits, type Tier } from "@/lib/api";

/**
 * The defaults README.md publishes. Public pages read the live values from
 * GET /api/limits and fall back to these only when the API is unreachable,
 * so a deployment that changes its limits never shows stale numbers.
 */
export const PUBLISHED_LIMITS = {
  anonymous: { perMinute: 120, perDay: 20_000 },
  free: { perMinute: 60, perDay: 1_000 },
  partner: { perMinute: 600, perDay: 100_000 },
} satisfies Record<string, Limits>;

/** README.md's per-client share of a publishable key's budget. */
export const PUBLISHED_CLIENT_SHARE: ClientShare = { perMinute: 0.25, perDay: 0.1 };

const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

/** One sentence explaining why a publishable key has a per-visitor cap, and what it is. */
export function clientShareSentence(share: ClientShare): string {
  return (
    "A publishable key is shared by every visitor of the site it is on, so one visitor (one IP address) " +
    `can use at most ${percent.format(share.perMinute)} of its per-minute limit and ` +
    `${percent.format(share.perDay)} of its per-day limit.`
  );
}

/** The SDK's default, and the hosted API's address. */
export const HOSTED_API_URL = "https://api.praytify.bible";

export const TIER_NAMES: Record<Tier, string> = { free: "Free", partner: "Partner", internal: "Internal" };

export interface ShownLimits {
  anonymous: Limits;
  free: Limits;
  partner: Limits;
  /** Null when the live gateway does not report one, so the page never claims a cap it does not enforce. */
  publishableClientShare: ClientShare | null;
  /** "live" when read from this deployment, "published" when falling back to the README defaults. */
  source: "live" | "published";
}

/** Live limits from the gateway, or the published defaults while loading or if it is unreachable. */
export function usePublishedLimits(): ShownLimits & { isPending: boolean } {
  const q = useQuery({ queryKey: ["public-limits"], queryFn: limits.get, staleTime: 5 * 60_000 });
  if (q.data) {
    return {
      anonymous: q.data.anonymous,
      free: q.data.tiers.free.secret,
      partner: q.data.tiers.partner.secret,
      publishableClientShare: q.data.publishableClientShare ?? null,
      source: "live",
      isPending: false,
    };
  }
  return { ...PUBLISHED_LIMITS, publishableClientShare: PUBLISHED_CLIENT_SHARE, source: "published", isPending: q.isPending };
}
