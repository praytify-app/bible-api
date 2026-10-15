import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EmptyStateProps {
  /** Only for a confirmed empty result. Loading and failed fetches have their own states. */
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** Heading level that fits the page outline. */
  titleAs?: "h2" | "h3";
  className?: string;
}

export function EmptyState({ title, description, icon, action, titleAs: Heading = "h2", className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <span aria-hidden className="flex size-12 items-center justify-center rounded-pill bg-accent-subtle text-accent-text [&_svg]:size-6">
          {icon}
        </span>
      )}
      <Heading className="text-h4 font-semibold text-ink">{title}</Heading>
      {description && <p className="max-w-sm text-body-sm text-ink-secondary">{description}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
