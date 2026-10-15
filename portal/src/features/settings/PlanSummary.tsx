import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Alert, Badge, Button, SkeletonText } from "@/components/ds";
import { TIER_NAMES } from "@/features/docs/published-limits";
import { LimitsTable } from "@/features/docs/RateLimitTable";
import { plan } from "@/lib/api";

const count = new Intl.NumberFormat();

/** Every number here comes from GET /api/dashboard/plan, never from copy (must-not-regress 11). */
export function PlanSummary() {
  const current = useQuery({ queryKey: ["plan"], queryFn: plan.get });

  if (current.isError) {
    return (
      <Alert
        tone="danger"
        title="Your plan could not be loaded."
        action={
          <Button variant="secondary" size="sm" loading={current.isFetching} onClick={() => current.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (current.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <SkeletonText lines={4} />
        <p className="sr-only">Loading your plan</p>
      </div>
    );
  }

  const p = current.data;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-secondary">
        You are on the{" "}
        <Badge tone="accent" className="align-middle">
          {TIER_NAMES[p.tier]}
        </Badge>{" "}
        plan, with up to{" "}
        <strong className="font-semibold text-ink">{count.format(p.maxKeys)} active keys</strong>.
      </p>
      <LimitsTable
        caption={`Rate limits on the ${TIER_NAMES[p.tier]} plan`}
        rows={[
          { who: "Secret keys, all combined", limits: p.limits.secret },
          { who: "Publishable keys, all combined", limits: p.limits.publishable },
          { who: "Anonymous, per IP", limits: p.limits.anonymous },
        ]}
      />
      <p className="text-body-sm text-ink-secondary">
        Quotas are per key kind and shared across your keys.{" "}
        <Link
          to="/docs/quickstart"
          hash="rate-limits"
          className="font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          How rate limits work
        </Link>
      </p>
    </div>
  );
}
