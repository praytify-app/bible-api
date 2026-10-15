import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  PageHeader,
  SkeletonText,
  Stat,
  type BadgeTone,
} from "@/components/ds";
import { API_URL, keys, plan, usage, type ApiKey, type KeyKind, type Limits, type Plan, type Tier, type UsageSummary } from "@/lib/api";
import { useSession } from "@/lib/auth";

// Home for the Integrator persona (BRIEF §5): is my key working, how much am I
// using, what are my limits. Every figure comes from the API; a failed query
// shows a dash and says so, never a 0 (AUDIT must-not-regress 9). Query keys
// match the keys and usage pages so moving between them reuses the data.

const numberFormat = new Intl.NumberFormat();
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const tierLabels: Record<Tier, string> = { free: "Free", partner: "Partner", internal: "Internal" };

/** "3 hours ago", "yesterday". Falls back to the date past a month. */
function timeAgo(iso: string): string {
  const then = new Date(iso);
  const seconds = Math.round((then.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (Number.isNaN(abs)) return "unknown";
  if (abs < 60) return relative.format(seconds, "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86400) return relative.format(Math.round(seconds / 86400), "day");
  return then.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function DashboardOverview() {
  const { data: session } = useSession();
  const summary = useQuery({ queryKey: ["usage-summary"], queryFn: () => usage.summary() });
  const keyList = useQuery({ queryKey: ["keys"], queryFn: () => keys.list() });
  const planQuery = useQuery({ queryKey: ["plan"], queryFn: () => plan.get() });

  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const failed = [summary, keyList, planQuery].filter((query) => query.isError);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Overview"
        title={firstName ? `Welcome, ${firstName}.` : "Welcome."}
        description="Your keys, your traffic, and the limits on your plan."
      />

      {failed.length > 0 && (
        <Alert
          tone="danger"
          title="Part of your dashboard could not load."
          action={
            <Button size="sm" variant="secondary" onClick={() => failed.forEach((query) => void query.refetch())}>
              Try again
            </Button>
          }
        >
          Anything that failed shows a dash instead of a number.
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <TrafficCard summary={summary} activeKeys={keyList.data?.length} />
          <KeysPanel query={keyList} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <PlanCard query={planQuery} />
          <ShortcutsCard />
        </div>
      </div>
    </div>
  );
}

function TrafficCard({ summary, activeKeys }: { summary: UseQueryResult<UsageSummary>; activeKeys: number | undefined }) {
  const data = summary.data;
  const loading = summary.isPending;
  const reason = "Usage could not be loaded";
  // The gateway reports the window it summed; without it, do not claim one.
  const period = data?.periodDays ? `Last ${data.periodDays} days` : undefined;

  return (
    <Card as="section" aria-labelledby="traffic-title">
      <CardHeader
        title={<span id="traffic-title">Traffic</span>}
        description="Every key on your account."
        actions={
          <Button asChild variant="link">
            <Link to="/dashboard/usage">View usage</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        <Stat label="Requests today" value={data?.requestsToday} loading={loading} unavailableReason={reason} />
        <Stat label="Requests" hint={period} value={data?.totalRequests} loading={loading} unavailableReason={reason} />
        <Stat label="Errors" hint={period} value={data?.totalErrors} loading={loading} unavailableReason={reason} />
        {/* The key list excludes revoked keys; prefer it over the summary (must-not-regress 10). */}
        <Stat
          label="Active keys"
          value={activeKeys ?? data?.activeKeys}
          loading={loading && activeKeys === undefined}
          unavailableReason="Keys could not be loaded"
        />
      </div>
    </Card>
  );
}

function KeysPanel({ query }: { query: UseQueryResult<ApiKey[]> }) {
  if (query.isPending) {
    return (
      <Card aria-busy="true">
        <SkeletonText lines={4} />
        <span className="sr-only">Loading your keys</span>
      </Card>
    );
  }
  // Never offer "create your first key" when we do not know there are none (AUDIT finding 2).
  if (query.isError || !query.data) {
    return (
      <Card as="section" aria-labelledby="keys-title">
        <CardHeader title={<span id="keys-title">API keys</span>} />
        <p className="text-body-sm text-ink-secondary">Your keys could not be loaded. They are still there.</p>
      </Card>
    );
  }
  return query.data.length === 0 ? <FirstRun /> : <KeyList keyList={query.data} />;
}

const curlExample = `curl "${API_URL}/v1/verses?ref=Psalm%2023:1-4&version=WEB"`;

/** No keys yet: the one decision on this page, so it gets the committed panel. */
function FirstRun() {
  return (
    <>
      <Card as="section" variant="committed" padding="lg" aria-labelledby="first-key-title">
        <div className="flex max-w-measure flex-col gap-3">
          <h2 id="first-key-title" className="text-h2 font-bold">
            Create your first key.
          </h2>
          <p className="text-body">
            A secret key is for your server. A publishable key works in the browser, only from the sites you list. Either
            one unlocks search and gives you your own quota.
          </p>
          <div className="pt-3">
            <Button asChild variant="secondary" trailingIcon={<ArrowRight aria-hidden />}>
              <Link to="/dashboard/keys">Create a key</Link>
            </Button>
          </div>
        </div>
      </Card>
      <Card as="section" aria-labelledby="try-title">
        <CardHeader
          title={<span id="try-title">Or try it without a key</span>}
          description="Reading is public. Run this from a terminal; the response is JSON."
        />
        <CodeBlock code={curlExample} language="bash" label="cURL" />
      </Card>
    </>
  );
}

const kinds: Record<KeyKind, { label: string; tone: BadgeTone }> = {
  secret: { label: "Secret", tone: "neutral" },
  publishable: { label: "Publishable", tone: "accent" },
};

function KeyList({ keyList }: { keyList: ApiKey[] }) {
  const shown = keyList.slice(0, 5);
  return (
    <Card as="section" aria-labelledby="keys-title">
      <CardHeader
        title={<span id="keys-title">API keys</span>}
        description={
          keyList.length > shown.length ? `Showing ${shown.length} of ${keyList.length}.` : "Your active keys."
        }
        actions={
          <Button asChild variant="link">
            <Link to="/dashboard/keys">Manage keys</Link>
          </Button>
        }
      />
      <ul className="divide-y divide-hairline border-t border-hairline">
        {shown.map((key) => (
          <li key={key.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-body-sm font-semibold text-ink">{key.name}</span>
              {key.kind && kinds[key.kind] && <Badge tone={kinds[key.kind].tone}>{kinds[key.kind].label}</Badge>}
            </div>
            <div className="flex items-center gap-4 text-caption text-ink-muted">
              {key.prefix && <code className="font-mono">{key.prefix}…</code>}
              <span>{key.lastUsedAt ? `Used ${timeAgo(key.lastUsedAt)}` : "Not used yet"}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function limitText(limits: Partial<Limits> | undefined): string | null {
  if (!limits) return null;
  const parts = [
    typeof limits.perMinute === "number" ? `${numberFormat.format(limits.perMinute)} a minute` : null,
    typeof limits.perDay === "number" ? `${numberFormat.format(limits.perDay)} a day` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Limits straight from GET /api/dashboard/plan; nothing here is typed in by hand. */
function PlanCard({ query }: { query: UseQueryResult<Plan> }) {
  const data = query.data;
  const rows = data
    ? [
        { label: "Secret keys", value: limitText(data.limits.secret) },
        { label: "Publishable keys", value: limitText(data.limits.publishable) },
        { label: "Without a key, per address", value: limitText(data.limits.anonymous) },
      ].filter((row): row is { label: string; value: string } => row.value !== null)
    : [];

  return (
    <Card as="section" aria-labelledby="plan-title">
      <CardHeader
        title={<span id="plan-title">Your plan</span>}
        actions={data ? <Badge tone="accent">{tierLabels[data.tier] ?? data.tier}</Badge> : undefined}
      />
      {query.isPending ? (
        <div aria-busy="true">
          <SkeletonText lines={3} />
          <span className="sr-only">Loading your plan</span>
        </div>
      ) : query.isError || !data ? (
        <p className="text-body-sm text-ink-secondary">Your plan's limits could not be loaded.</p>
      ) : (
        <dl className="flex flex-col divide-y divide-hairline">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5 py-2.5 first:pt-0">
              <dt className="text-caption text-ink-muted">{row.label}</dt>
              <dd className="text-body-sm font-medium tabular-nums text-ink">{row.value}</dd>
            </div>
          ))}
          {typeof data.maxKeys === "number" && (
            <div className="flex flex-col gap-0.5 py-2.5">
              <dt className="text-caption text-ink-muted">Active keys allowed</dt>
              <dd className="text-body-sm font-medium tabular-nums text-ink">{numberFormat.format(data.maxKeys)}</dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  );
}

const shortcuts = [
  { label: "Build an embed snippet", to: "/dashboard/embed" },
  { label: "Read the quick start", to: "/docs/quickstart" },
  { label: "Browse the API reference", to: "/docs" },
  { label: "Find a translation", to: "/docs/translations" },
] as const;

function ShortcutsCard() {
  return (
    <nav aria-label="Shortcuts">
      <Card padding="sm">
        <ul className="flex flex-col">
          {shortcuts.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="group flex min-h-11 items-center justify-between gap-3 rounded-input px-2 text-body-sm font-medium text-ink transition-colors hover:bg-surface-sunken hover:text-accent-text"
              >
                {item.label}
                <ArrowRight aria-hidden className="size-4 text-ink-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </nav>
  );
}
