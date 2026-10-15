import type { ReactNode } from "react";
import { cx } from "./cx";

export interface EyebrowProps {
  children: ReactNode;
  /** Section number from the editorial layout: "01". Sits on a short rule. */
  index?: string;
  tone?: "muted" | "accent";
  as?: "p" | "span" | "div";
  className?: string;
}

/** Small uppercase label above a heading. Plus Jakarta with tracking stands in for the brand's mono. */
export function Eyebrow({ children, index, tone = "muted", as: Tag = "p", className }: EyebrowProps) {
  return (
    <Tag
      className={cx(
        "flex items-center gap-3 text-eyebrow font-semibold uppercase",
        tone === "accent" ? "text-accent-text" : "text-ink-muted",
        className,
      )}
    >
      {index && (
        <>
          <span className="tabular-nums">{index}</span>
          <span aria-hidden className="h-px w-8 bg-current opacity-40" />
        </>
      )}
      <span>{children}</span>
    </Tag>
  );
}
