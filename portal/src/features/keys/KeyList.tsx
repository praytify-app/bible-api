import { Link } from "@tanstack/react-router";
import { Ellipsis, KeyRound, Pencil, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useId, useState, type Ref } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ds";
import type { KeyKind, KeyUsage } from "@/lib/api";
import { KIND_INFO, absoluteTime, expiryLabel, expiryState, kindOf, relativeTime, shortDate } from "./kinds";
import { insecureOriginWarning } from "./origins";
import { USAGE_DAYS, type KeyMeta } from "./queries";
import { useNow } from "./use-now";

type Filter = "all" | KeyKind;

export interface KeyListProps {
  keys: KeyMeta[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  usage: { data: KeyUsage[] | undefined; isLoading: boolean; isError: boolean };
  onCreate: () => void;
  onEdit: (key: KeyMeta) => void;
  onRoll: (key: KeyMeta) => void;
  onRevoke: (key: KeyMeta) => void;
  /** Focus lands here after a revoke removes the row that had it. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Template frame: CustomerList (card, title row with view tabs, table). */
export function KeyList(props: KeyListProps) {
  const { keys, isLoading, error, onRetry, onCreate, headingRef } = props;
  const [filter, setFilter] = useState<Filter>("all");
  const headingId = useId();

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 pt-5 sm:px-6">
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-h3 font-semibold text-ink">
        Active keys
      </h2>
      {keys && keys.length > 0 && (
        <TabsList aria-label="Show keys of kind">
          <TabsTrigger value="all">All {keys.length}</TabsTrigger>
          <TabsTrigger value="secret">Secret {count(keys, "secret")}</TabsTrigger>
          <TabsTrigger value="publishable">Publishable {count(keys, "publishable")}</TabsTrigger>
        </TabsList>
      )}
    </div>
  );

  // Error before loading before empty: a failed fetch must never read as "no keys" (AUDIT finding 2).
  let body;
  if (error) {
    body = (
      <div className="px-5 pb-6 sm:px-6">
        <Alert
          tone="danger"
          title="Your keys could not be loaded"
          action={
            <Button variant="secondary" size="sm" leadingIcon={<RefreshCw />} onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error.message || "The dashboard API did not answer."} Your keys are unchanged.
        </Alert>
      </div>
    );
  } else if (isLoading || !keys) {
    body = (
      <div aria-busy="true" aria-label="Loading keys" className="flex flex-col gap-3 px-5 pb-6 sm:px-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-input" />
        ))}
      </div>
    );
  } else if (keys.length === 0) {
    body = (
      <div className="px-5 pb-8 sm:px-6">
        <EmptyState
          titleAs="h3"
          icon={<KeyRound />}
          title="No API keys yet"
          description="Create a secret key for your server, or a publishable key for a website. Both work the moment they are created."
          action={
            <Button leadingIcon={<Plus />} onClick={onCreate}>
              Create your first key
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <Card padding="none" as="section" aria-labelledby={headingId}>
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        {header}
        {body ??
          (["all", "secret", "publishable"] as const).map((value) => (
            <TabsContent key={value} value={value} className="mt-0">
              <KeyTable {...props} keys={value === "all" ? keys! : keys!.filter((k) => kindOf(k) === value)} />
            </TabsContent>
          ))}
      </Tabs>
      {!body && (
        <p className="border-t border-hairline px-5 py-3 text-caption text-ink-muted sm:px-6">
          Requests cover the last {USAGE_DAYS} days and update about every 10 minutes. Last used updates at most once a
          minute.
        </p>
      )}
    </Card>
  );
}

function count(keys: KeyMeta[], kind: KeyKind): number {
  return keys.filter((k) => kindOf(k) === kind).length;
}

function KeyTable({ keys, usage, onEdit, onRoll, onRevoke }: KeyListProps & { keys: KeyMeta[] }) {
  const now = useNow();
  if (keys.length === 0) {
    return <p className="px-5 pb-6 text-body-sm text-ink-secondary sm:px-6">No keys of this kind.</p>;
  }
  const byId = new Map((usage.data ?? []).map((u) => [u.keyId, u]));

  return (
    <div className="px-3 pb-3 sm:px-4 sm:pb-4">
      <Table caption="Your active API keys" stackOnMobile>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Kind</TableHeaderCell>
            <TableHeaderCell>Allowed origins</TableHeaderCell>
            <TableHeaderCell>Created</TableHeaderCell>
            <TableHeaderCell>Last used</TableHeaderCell>
            <TableHeaderCell>Expires</TableHeaderCell>
            <TableHeaderCell className="text-right">
              Requests
              <span className="block font-normal">last {USAGE_DAYS} days</span>
            </TableHeaderCell>
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((key) => {
            const kind = kindOf(key);
            const expiry = expiryState(key.expiresAt, now);
            return (
              <TableRow key={key.id} data-key-id={key.id}>
                <TableCell label="Name">
                  <div className="flex min-w-0 flex-col gap-0.5 md:max-w-56">
                    <span className="break-words font-semibold text-ink">{key.name}</span>
                    <span className="font-mono text-caption text-ink-muted">{key.prefix ?? "No prefix"}</span>
                  </div>
                </TableCell>
                <TableCell label="Kind">
                  <Badge tone={KIND_INFO[kind].badgeTone}>{KIND_INFO[kind].label}</Badge>
                </TableCell>
                <TableCell label="Allowed origins">
                  <Origins kind={kind} origins={key.allowedOrigins ?? []} />
                </TableCell>
                <TableCell label="Created" className="whitespace-nowrap">
                  <time dateTime={key.createdAt} title={absoluteTime(key.createdAt)}>
                    {shortDate(key.createdAt)}
                  </time>
                </TableCell>
                <TableCell label="Last used" className="whitespace-nowrap">
                  {key.lastUsedAt ? (
                    <time dateTime={key.lastUsedAt} title={absoluteTime(key.lastUsedAt)} data-testid="last-used">
                      {relativeTime(key.lastUsedAt, now)}
                    </time>
                  ) : (
                    <span className="text-ink-muted" data-testid="last-used">
                      Never
                    </span>
                  )}
                </TableCell>
                <TableCell label="Expires" className="whitespace-nowrap" data-testid="expires">
                  {expiry.state === "never" ? (
                    <span className="text-ink-muted">Never</span>
                  ) : expiry.state === "active" ? (
                    <time dateTime={key.expiresAt!} title={absoluteTime(key.expiresAt!)}>
                      {shortDate(key.expiresAt!)}
                    </time>
                  ) : (
                    <time dateTime={key.expiresAt!} title={absoluteTime(key.expiresAt!)}>
                      <Badge tone={expiry.state === "expired" ? "danger" : "warning"}>{expiryLabel(expiry)}</Badge>
                    </time>
                  )}
                </TableCell>
                <TableCell label={`Requests (${USAGE_DAYS} days)`} className="whitespace-nowrap md:text-right">
                  <UsageCell keyId={key.id} name={key.name} usage={usage} row={byId.get(key.id)} />
                </TableCell>
                <TableCell label="Actions" className="md:w-14 md:pr-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        label={`Actions for ${key.name}`}
                        icon={<Ellipsis />}
                        variant="ghost"
                        size="sm"
                        data-row-actions=""
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(key)}>
                        {kind === "publishable" ? "Rename or edit origins" : "Rename"}
                      </DropdownMenuItem>
                      <DropdownMenuItem icon={<RefreshCw />} onSelect={() => onRoll(key)}>
                        Roll key
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => onRevoke(key)}>
                        Revoke key
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Origins({ kind, origins }: { kind: KeyKind; origins: string[] }) {
  if (kind === "secret") return <span className="text-ink-muted">Servers only</span>;
  if (origins.length === 0) return <span className="text-ink-muted">None</span>;
  const insecure = origins.some((o) => insecureOriginWarning(o));
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {origins.map((origin) => (
          <li key={origin} className="font-mono text-caption text-ink wrap-anywhere md:whitespace-nowrap">
            {origin}
          </li>
        ))}
      </ul>
      {insecure && (
        <span className="flex items-center gap-1 text-caption font-medium text-warning md:whitespace-nowrap">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
          Includes a plain http site
        </span>
      )}
    </div>
  );
}

function UsageCell({
  keyId,
  name,
  usage,
  row,
}: {
  keyId: string;
  name: string;
  usage: KeyListProps["usage"];
  row: KeyUsage | undefined;
}) {
  // Never a fabricated zero: unknown usage says so (AUDIT must-not-regress 9).
  if (usage.isError) return <span className="text-ink-muted">Unavailable</span>;
  if (usage.isLoading) return <Skeleton className="ml-auto h-4 w-16" />;
  const requests = row?.requests ?? 0;
  const errors = row?.errors ?? 0;
  const n = new Intl.NumberFormat();
  return (
    <div className="flex flex-col items-end gap-0.5 max-md:items-end">
      <Link
        to="/dashboard/usage"
        search={{ keyId }}
        aria-label={`${n.format(requests)} requests, ${n.format(errors)} errors. View usage for ${name}`}
        className="font-semibold text-accent-text underline-offset-4 hover:underline"
      >
        {n.format(requests)}
      </Link>
      <span className={errors > 0 ? "text-caption text-danger" : "text-caption text-ink-muted"}>
        {n.format(errors)} {errors === 1 ? "error" : "errors"}
      </span>
    </div>
  );
}
