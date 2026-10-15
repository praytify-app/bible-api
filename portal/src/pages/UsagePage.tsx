import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Alert, Badge, Button, Card, CardHeader, PageHeader, Select, Skeleton, Stat } from "@/components/ds";
import { formatDay, zeroFill } from "@/features/usage/fill";
import { KeyUsageTable } from "@/features/usage/KeyUsageTable";
import { DEFAULT_PERIOD, PERIODS, usageHref, validateUsageSearch, type UsageSearch } from "@/features/usage/search";
import { UsageChart } from "@/features/usage/UsageChart";
import { keys, usage } from "@/lib/api";

const count = new Intl.NumberFormat();
const periodOptions = PERIODS.map((d) => ({ value: String(d), label: `Last ${d} days` }));
const UNAVAILABLE = "Could not be loaded";

export function UsagePage() {
  const navigate = useNavigate();
  const raw: Record<string, unknown> = useSearch({ strict: false });
  const { days = DEFAULT_PERIOD, keyId } = validateUsageSearch(raw);
  const ignoredKeyFilter = raw.keyId !== undefined && !keyId;

  const setView = (next: UsageSearch) => navigate({ href: usageHref(next), replace: true });

  const daily = useQuery({
    queryKey: ["usage-daily", days, keyId ?? "all"],
    queryFn: () => usage.daily(days, keyId),
  });
  const summary = useQuery({ queryKey: ["usage-summary", days], queryFn: () => usage.summary(days) });
  const byKey = useQuery({ queryKey: ["usage-by-key", days], queryFn: () => usage.byKey(days) });

  // Name the charted key. Keys without traffic in the period are not in byKey, so fall back to the key list.
  const keyFromUsage = keyId ? byKey.data?.find((k) => k.keyId === keyId) : undefined;
  const keyList = useQuery({
    queryKey: ["keys"],
    queryFn: () => keys.list(),
    enabled: Boolean(keyId) && byKey.isSuccess && !keyFromUsage,
  });
  const keyName = keyFromUsage?.name ?? keyList.data?.find((k) => k.id === keyId)?.name ?? "Selected key";

  // Zero-fill only a successful response; an error stays an error (must-not-regress 9).
  const chartData = daily.isSuccess ? zeroFill(daily.data.daily, daily.data.period.from, daily.data.period.to) : null;
  const periodDays = summary.data?.periodDays ?? days;
  const periodLabel = `last ${periodDays} days`;
  const failed = [daily, summary, byKey].filter((q) => q.isError);

  const s = summary.isError ? undefined : summary.data;
  const errorRate =
    s && s.totalRequests > 0 ? `${((s.totalErrors / s.totalRequests) * 100).toFixed(1)}% of requests` : undefined;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Usage"
        serifLine="requests by day and by key"
        description="Counts come from your API keys and are grouped by UTC day. Anonymous traffic is not counted here."
        actions={
          <Select
            aria-label="Period"
            options={periodOptions}
            value={String(days)}
            onValueChange={(value) => setView({ days: Number(value) as UsageSearch["days"], keyId })}
            className="min-w-44"
          />
        }
      />

      {failed.length > 0 && (
        <Alert
          tone="danger"
          title="Some usage data could not be loaded."
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={failed.some((q) => q.isFetching)}
              onClick={() => failed.forEach((q) => q.refetch())}
            >
              Try again
            </Button>
          }
        >
          The sections marked unavailable show a dash, not a zero, until they load.
        </Alert>
      )}
      {ignoredKeyFilter && (
        <Alert tone="warning" onDismiss={() => setView({ days })}>
          That link had a key filter this page does not recognise, so the chart shows all keys.
        </Alert>
      )}

      <Card as="section" aria-labelledby="usage-summary-title">
        <CardHeader
          title={<span id="usage-summary-title">Totals, {periodLabel}</span>}
          description={keyId ? "All keys. The chart below shows one key." : "All keys."}
        />
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-5">
          <Stat label="Requests" value={s?.totalRequests} loading={summary.isPending} unavailableReason={UNAVAILABLE} />
          <Stat
            label="Errors"
            value={s?.totalErrors}
            hint={errorRate}
            loading={summary.isPending}
            unavailableReason={UNAVAILABLE}
          />
          <Stat
            label="Avg response"
            // An average of no requests is not 0 ms.
            value={s && s.totalRequests === 0 ? "None" : s?.avgResponseTimeMs}
            hint={s && s.totalRequests === 0 ? "No requests to time" : undefined}
            format={(ms) => `${count.format(ms)} ms`}
            loading={summary.isPending}
            unavailableReason={UNAVAILABLE}
          />
          <Stat
            label="Requests today"
            value={s?.requestsToday}
            hint="Since midnight UTC"
            loading={summary.isPending}
            unavailableReason={UNAVAILABLE}
          />
          <Stat label="Active keys" value={s?.activeKeys} loading={summary.isPending} unavailableReason={UNAVAILABLE} />
        </div>
      </Card>

      <Card as="section" aria-labelledby="usage-daily-title">
        <CardHeader
          title={<span id="usage-daily-title">Requests per day</span>}
          description={
            daily.isSuccess
              ? `${formatDay(daily.data.period.from, "long")} to ${formatDay(daily.data.period.to, "long")}, UTC.`
              : undefined
          }
          actions={
            keyId ? (
              <span className="inline-flex items-center gap-1">
                <Badge tone="accent">Key: {keyName}</Badge>
                <Button variant="ghost" size="sm" leadingIcon={<X aria-hidden />} onClick={() => setView({ days })}>
                  Show all keys
                </Button>
              </span>
            ) : undefined
          }
        />
        {daily.isError ? (
          // Checked before loading: a failure must never fall through to an empty, zero-looking chart.
          <div className="flex h-72 flex-col items-center justify-center gap-1 rounded-input bg-surface-sunken px-6 text-center">
            <p className="font-semibold text-ink">Daily usage is unavailable right now.</p>
            <p className="text-body-sm text-ink-secondary">Nothing is shown rather than a misleading zero.</p>
          </div>
        ) : daily.isPending || !chartData ? (
          <div aria-busy>
            <Skeleton className="h-72 w-full" />
            <p className="sr-only">Loading daily usage</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {chartData.every((d) => d.requests === 0) && (
              <p className="text-body-sm text-ink-secondary">
                {keyId ? "No requests with this key" : "No requests with your keys"} in this period yet.
              </p>
            )}
            <UsageChart data={chartData} />
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="usage-keys-title">
        <CardHeader
          title={<span id="usage-keys-title">By key</span>}
          description={`Requests and errors per key, ${periodLabel}. Revoked keys keep their history.`}
        />
        <KeyUsageTable
          query={byKey}
          periodLabel={periodLabel}
          selectedKeyId={keyId}
          onChartKey={(next) => setView({ days, keyId: next })}
        />
      </Card>
    </div>
  );
}
