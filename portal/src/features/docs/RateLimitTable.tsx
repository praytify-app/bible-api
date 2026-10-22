import { useQuery } from "@tanstack/react-query";
import { Alert, SkeletonText, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ds";
import { plan, type Limits } from "@/lib/api";
import { useSession } from "@/lib/auth";
import { clientShareSentence, TIER_NAMES as tierNames, usePublishedLimits } from "./published-limits";

const count = new Intl.NumberFormat();

export interface LimitsRow {
  who: string;
  limits: Limits;
}

export function LimitsTable({ caption, rows }: { caption: string; rows: LimitsRow[] }) {
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


/**
 * Visitors see the published limits. Signed-in developers see their own plan,
 * straight from the gateway, so the numbers cannot drift from the limiter.
 */
export function RateLimitTable() {
  const { data: session, isPending: sessionPending } = useSession();
  const signedIn = Boolean(session?.user);
  const current = useQuery({ queryKey: ["plan"], queryFn: plan.get, enabled: signedIn });
  const shown = usePublishedLimits();
  const publishedRows: LimitsRow[] = [
    { who: "Anonymous, per IP", limits: shown.anonymous },
    { who: "Free account, per key kind", limits: shown.free },
    { who: "Partner, per key kind", limits: shown.partner },
  ];

  if (sessionPending || (signedIn && current.isPending)) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <SkeletonText lines={3} />
        <p className="sr-only">Loading rate limits</p>
      </div>
    );
  }

  const shareNote = shown.publishableClientShare && (
    <p className="text-sm text-ink-secondary">{clientShareSentence(shown.publishableClientShare)}</p>
  );

  if (signedIn && current.data) {
    const p = current.data;
    return (
      <div className="flex flex-col gap-3">
        <LimitsTable
          caption={`Your rate limits on the ${tierNames[p.tier]} plan`}
          rows={[
            { who: `Secret keys (${tierNames[p.tier]} plan)`, limits: p.limits.secret },
            { who: `Publishable keys (${tierNames[p.tier]} plan)`, limits: p.limits.publishable },
            { who: "Anonymous, per IP", limits: p.limits.anonymous },
          ]}
        />
        {shareNote}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {signedIn && current.isError && (
        <Alert tone="warning">We could not load your plan, so these are the published limits.</Alert>
      )}
      <LimitsTable
        caption={shown.source === "live" ? "Rate limits on this server" : "Published rate limits"}
        rows={publishedRows}
      />
      {shareNote}
    </div>
  );
}
