import type { Limits } from "@/lib/api";

/**
 * The limits README.md publishes ("Use the hosted API"). Public pages show
 * these to visitors who are not signed in; signed-in developers see their
 * live plan from GET /api/dashboard/plan instead. Keep in step with the
 * README and with src/plans.ts.
 */
export const PUBLISHED_LIMITS = {
  anonymous: { perMinute: 120, perDay: 20_000 },
  free: { perMinute: 60, perDay: 1_000 },
  partner: { perMinute: 600, perDay: 100_000 },
} satisfies Record<string, Limits>;

/** The SDK's default, and the hosted API's address. */
export const HOSTED_API_URL = "https://api.praytify.bible";
