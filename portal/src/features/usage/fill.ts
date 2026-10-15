import type { DailyUsage } from "@/lib/api";

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" from whatever the gateway serialised (a bare date or a UTC timestamp). */
export function utcDateKey(value: string): string {
  return value.slice(0, 10);
}

function parseUtcDate(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Every UTC date from `from` to `to`, inclusive. Pure date arithmetic, so local time zones cannot shift it. */
export function utcDays(from: string, to: string): string[] {
  const start = parseUtcDate(utcDateKey(from));
  const end = parseUtcDate(utcDateKey(to));
  const days: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}

/**
 * One row per day of the period. The gateway omits days without traffic, so
 * those become zeros here. Call it only with a successful response: a failed
 * request must render as an error, never as a row of zeros (must-not-regress 9).
 */
export function zeroFill(daily: DailyUsage[], from: string, to: string): DailyUsage[] {
  const byDate = new Map(daily.map((d) => [utcDateKey(d.date), d]));
  return utcDays(from, to).map(
    (date) => {
      const row = byDate.get(date);
      return row ? { ...row, date } : { date, requests: 0, errors: 0, avgResponseTimeMs: 0 };
    },
  );
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Formatted in UTC, the zone the data is bucketed in, so viewers west of UTC see the right day. */
export function formatDay(key: string, style: "short" | "long" = "short"): string {
  const date = new Date(parseUtcDate(utcDateKey(key)));
  return (style === "short" ? shortDate : longDate).format(date);
}
