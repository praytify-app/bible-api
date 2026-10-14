import { useQuery } from "@tanstack/react-query";
import { Alert, SkeletonText, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ds";
import { plan, type Limits, type Tier } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { PUBLISHED_LIMITS } from "./published-limits";

const count = new Intl.NumberFormat();

const tierNames: Record<Tier, string> = { free: "Free", partner: "Partner", internal: "Internal" };

interface Row {
  who: string;
  limits: Limits;
}

function LimitsTable({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <Table caption={caption} stackOnMobile>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Who</TableHeaderCell>
          <TableHeaderCell className="text-right">Per minute</TableHeaderCell>
          <TableHeaderCell className="text-right">Per day</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.who}>
            <TableCell className="font-semibold">{row.who}</TableCell>
            <TableCell label="Per minute" className="text-right tabular-nums">
              {count.format(row.limits.perMinute)}
            </TableCell>
            <TableCell label="Per day" className="text-right tabular-nums">
              {count.format(row.limits.perDay)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const publishedRows: Row[] = [
  { who: "Anonymous, per IP", limits: PUBLISHED_LIMITS.anonymous },
  { who: "Free account, per key kind", limits: PUBLISHED_LIMITS.free },
  { who: "Partner, per key kind", limits: PUBLISHED_LIMITS.partner },
];

/**
 * Visitors see the published limits. Signed-in developers see their own plan,
 * straight from the gateway, so the numbers cannot drift from the limiter.
 */
export function RateLimitTable() {
  const { data: session, isPending: sessionPending } = useSession();
  const signedIn = Boolean(session?.user);
  const current = useQuery({ queryKey: ["plan"], queryFn: plan.get, enabled: signedIn });

  if (sessionPending || (signedIn && current.isPending)) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <SkeletonText lines={3} />
        <p className="sr-only">Loading rate limits</p>
      </div>
    );
  }

  if (signedIn && current.data) {
    const p = current.data;
    return (
      <LimitsTable
        caption={`Your rate limits on the ${tierNames[p.tier]} plan`}
        rows={[
          { who: `Secret keys (${tierNames[p.tier]} plan)`, limits: p.limits.secret },
          { who: `Publishable keys (${tierNames[p.tier]} plan)`, limits: p.limits.publishable },
          { who: "Anonymous, per IP", limits: p.limits.anonymous },
        ]}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {signedIn && current.isError && (
        <Alert tone="warning">We could not load your plan, so these are the published limits.</Alert>
      )}
      <LimitsTable caption="Published rate limits" rows={publishedRows} />
    </div>
  );
}
