import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

const variants = {
  raised: "rounded-card border border-hairline bg-surface-raised shadow-raised",
  outline: "rounded-card border border-border bg-transparent",
  sunken: "rounded-card bg-surface-sunken",
  /** DESIGN.md committed panel: decision points only, never decoration. */
  committed: "rounded-panel bg-committed text-on-accent shadow-committed",
} as const;

const paddings = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" } as const;

export interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: keyof typeof variants;
  padding?: keyof typeof paddings;
  /** Landmark or list semantics when the card is one: "section", "article", "li". */
  as?: "div" | "section" | "article" | "li";
}

/** One level only: never nest a Card in a Card (DESIGN.md). */
export function Card({ variant = "raised", padding = "md", as: Tag = "div", className, ...props }: CardProps) {
  return <Tag {...props} className={cx(variants[variant], paddings[padding], className)} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or a menu aligned to the title. */
  actions?: ReactNode;
  /** Match the page outline: h2 under a page h1, h3 inside a section. */
  titleAs?: "h2" | "h3";
  className?: string;
}

export function CardHeader({ title, description, actions, titleAs: Heading = "h2", className }: CardHeaderProps) {
  return (
    <div className={cx("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <Heading className="text-h4 font-semibold">{title}</Heading>
        {description && <p className="text-body-sm text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
