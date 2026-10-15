import type { ReactNode } from "react";
import { cx } from "./cx";
import { Skeleton } from "./Skeleton";
import { VisuallyHidden } from "./VisuallyHidden";

export interface StatProps {
  label: ReactNode;
  /**
   * The number. null or undefined means "we do not know" (failed or missing
   * data) and renders a dash with `unavailableReason`, never a fake 0.
   */
  value: number | string | null | undefined;
  hint?: ReactNode;
  /** Shown under the dash when value is missing: "Usage could not be loaded." */
  unavailableReason?: string;
  loading?: boolean;
  /** Number formatter. Defaults to the reader's locale grouping. */
  format?: (value: number) => string;
  className?: string;
}

const defaultFormat = new Intl.NumberFormat().format;

export function Stat({
  label,
  value,
  hint,
  unavailableReason = "Not available",
  loading = false,
  format = defaultFormat,
  className,
}: StatProps) {
  const missing = value === null || value === undefined;
  return (
    <dl aria-busy={loading || undefined} className={cx("flex flex-col gap-1", className)}>
      <dt className="text-body-sm font-medium text-ink-secondary">{label}</dt>
      <dd className="text-h2 font-semibold tabular-nums text-ink">
        {loading ? (
          <>
            <Skeleton className="my-1 h-7 w-24" />
            <VisuallyHidden>Loading</VisuallyHidden>
          </>
        ) : missing ? (
          <>
            <span aria-hidden>—</span>
            <VisuallyHidden>{unavailableReason}</VisuallyHidden>
          </>
        ) : typeof value === "number" ? (
          format(value)
        ) : (
          value
        )}
      </dd>
      {!loading && missing ? (
        <dd aria-hidden className="text-caption text-ink-muted">
          {unavailableReason}
        </dd>
      ) : hint ? (
        <dd className="text-caption text-ink-muted">{hint}</dd>
      ) : null}
    </dl>
  );
}
