import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChartLine } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ds";
import type { KeyUsage } from "@/lib/api";

const count = new Intl.NumberFormat();

export interface KeyUsageTableProps {
  query: UseQueryResult<KeyUsage[]>;
  periodLabel: string;
  selectedKeyId?: string;
  onChartKey: (keyId: string | undefined) => void;
}

export function KeyUsageTable({ query, periodLabel, selectedKeyId, onChartKey }: KeyUsageTableProps) {
  if (query.isError) {
    return (
      <Alert
        tone="danger"
        title="Usage by key could not be loaded."
        action={
          <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (query.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <SkeletonText lines={3} />
        <p className="sr-only">Loading usage by key</p>
      </div>
    );
  }

  if (query.data.length === 0) {
    return (
      <EmptyState
        titleAs="h3"
        title="No key traffic in this period"
        description="Requests made with one of your keys show up here, including keys you have since revoked."
        action={
          <Button asChild variant="secondary">
            <Link to="/dashboard/keys">Manage keys</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Table caption={`Requests and errors per key, ${periodLabel}`} stackOnMobile>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Key</TableHeaderCell>
          <TableHeaderCell className="text-right">Requests</TableHeaderCell>
          <TableHeaderCell className="text-right">Errors</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Chart</span>
          </TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {query.data.map((k) => {
          const charted = k.keyId === selectedKeyId;
          return (
            <TableRow key={k.keyId} className={charted ? "bg-accent-subtle" : undefined}>
              <TableCell label="Key">
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{k.name}</span>
                  <Badge tone={k.kind === "publishable" ? "info" : "neutral"}>
                    {k.kind === "publishable" ? "Publishable" : "Secret"}
                  </Badge>
                  {k.revoked && <Badge tone="warning">Revoked</Badge>}
                </span>
              </TableCell>
              <TableCell label="Requests" className="text-right tabular-nums">
                {count.format(k.requests)}
              </TableCell>
              <TableCell label="Errors" className="text-right tabular-nums">
                {count.format(k.errors)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant={charted ? "secondary" : "ghost"}
                  size="sm"
                  leadingIcon={<ChartLine aria-hidden />}
                  aria-pressed={charted}
                  onClick={() => onChartKey(charted ? undefined : k.keyId)}
                >
                  {/* aria-pressed carries the state, so the name stays the same either way. */}
                  Chart this key
                  <span className="sr-only">: {k.name}</span>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
