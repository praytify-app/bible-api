import { useCallback, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ds";
import type { DailyUsage } from "@/lib/api";
import { readToken, useTheme } from "@/lib/theme";
import { formatDay } from "./fill";

const count = new Intl.NumberFormat();

interface ChartColors {
  requests: string;
  errors: string;
  grid: string;
  axis: string;
}

/**
 * SVG attributes do not resolve var(), so series colours are read from the
 * tokens. ThemeProvider sets data-theme on <html> in its own effect, which
 * runs after this component renders, so the colours are read from a probe
 * element that carries the resolved theme itself (tokens resolve per subtree).
 */
function useChartColors() {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors | null>(null);
  const probe = useCallback(
    (element: HTMLSpanElement | null) => {
      if (!element) return;
      setColors({
        requests: readToken("--chart-1", element),
        errors: readToken("--chart-2", element),
        grid: readToken("--chart-grid", element),
        axis: readToken("--chart-axis", element),
      });
    },
    // A new callback per theme makes React call it again with the re-themed probe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedTheme],
  );
  return { colors, probeElement: <span ref={probe} data-theme={resolvedTheme} hidden /> };
}

export interface UsageChartProps {
  /** Already zero-filled, one row per UTC day. */
  data: DailyUsage[];
}

export function UsageChart({ data }: UsageChartProps) {
  const { colors, probeElement } = useChartColors();
  const total = data.reduce((sum, d) => sum + d.requests, 0);
  const peak = data.reduce<DailyUsage | null>((best, d) => (!best || d.requests > best.requests ? d : best), null);
  const summary =
    data.length === 0
      ? "No days in this period."
      : `Requests per day from ${formatDay(data[0].date, "long")} to ${formatDay(data[data.length - 1].date, "long")}: ${count.format(total)} in total` +
        (peak && peak.requests > 0 ? `, highest on ${formatDay(peak.date, "long")} with ${count.format(peak.requests)}.` : ".");

  return (
    <div className="flex flex-col gap-4">
      {probeElement}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-caption text-ink-secondary" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-pill" style={{ background: colors?.requests }} />
          Requests
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: colors?.errors }} />
          Errors
        </span>
      </div>
      <div role="img" aria-label={summary} className="h-72">
        {colors && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatDay(value)}
                tick={{ fontSize: 12, fill: colors.axis }}
                tickLine={false}
                axisLine={{ stroke: colors.grid }}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: colors.axis }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                // HTML, not SVG: var() works here, so the tooltip follows the theme without a re-read.
                contentStyle={{
                  background: "var(--surface-overlay)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "var(--elev-overlay)",
                  color: "var(--ink)",
                  fontSize: "13px",
                }}
                labelStyle={{ color: "var(--ink)", fontWeight: 600 }}
                labelFormatter={(label) => (typeof label === "string" ? formatDay(label, "long") : "")}
                formatter={(value, name) => [count.format(Number(value)), name === "errors" ? "Errors" : "Requests"]}
              />
              <Line
                type="monotone"
                dataKey="requests"
                stroke={colors.requests}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: colors.requests }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="errors"
                stroke={colors.errors}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: colors.errors }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <details className="group text-body-sm">
        <summary className="cursor-pointer font-semibold text-accent-text">Show the daily numbers</summary>
        <div className="mt-3">
          <Table caption="Requests, errors, and response time per day (UTC)">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Day (UTC)</TableHeaderCell>
                <TableHeaderCell className="text-right">Requests</TableHeaderCell>
                <TableHeaderCell className="text-right">Errors</TableHeaderCell>
                <TableHeaderCell className="text-right">Avg response</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.date}>
                  <TableCell>{formatDay(d.date, "long")}</TableCell>
                  <TableCell className="text-right tabular-nums">{count.format(d.requests)}</TableCell>
                  <TableCell className="text-right tabular-nums">{count.format(d.errors)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.requests > 0 ? `${count.format(d.avgResponseTimeMs)} ms` : "No requests"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}
