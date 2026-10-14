import type { ReactNode } from "react";
import { cx } from "./cx";
import { Eyebrow } from "./Eyebrow";

export interface PageHeaderProps {
  /** The bold sans line. */
  title: string;
  /**
   * The italic serif line of the brand's two-voice headline. Page-level
   * headlines only; never on section or card headings.
   */
  serifLine?: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** hero: landing-page scale. page: every other page. */
  size?: "page" | "hero";
  className?: string;
}

export function PageHeader({ title, serifLine, eyebrow, description, actions, size = "page", className }: PageHeaderProps) {
  return (
    <header className={cx("flex flex-col gap-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex max-w-measure flex-col gap-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className={cx(size === "hero" ? "text-display" : "text-h1", "text-balance text-ink")}>
          <span className="block font-sans font-bold">{title}</span>
          {serifLine && (
            // Deep italic descenders: padded, never clipped.
            <span className="block pb-[0.08em] font-serif font-medium italic text-accent-text">{serifLine}</span>
          )}
        </h1>
        {description && <p className="text-body-lg text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
