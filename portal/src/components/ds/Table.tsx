import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";
import { TableStackContext, useTableStacked } from "./table-context";

export interface TableProps extends ComponentProps<"table"> {
  /** Required. Names the table for screen readers and labels the scroll region. */
  caption: string;
  /** Show the caption visually (it is always available to assistive technology). */
  showCaption?: boolean;
  /**
   * Below md, render each row as a stacked card with labels from TableCell `label`.
   * Otherwise the table scrolls horizontally inside a keyboard-focusable region.
   */
  stackOnMobile?: boolean;
}

// The scroll region is only a tab stop when it actually scrolls, so wide tables
// are reachable by keyboard and narrow ones add no dead stop.
function useOverflowing<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setOverflowing(element.scrollWidth > element.clientWidth + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, overflowing] as const;
}

export function Table({ caption, showCaption = false, stackOnMobile = false, className, children, ...props }: TableProps) {
  const [ref, overflowing] = useOverflowing<HTMLDivElement>();
  return (
    <TableStackContext.Provider value={stackOnMobile}>
      <div
        ref={ref}
        role={overflowing ? "region" : undefined}
        aria-label={overflowing ? caption : undefined}
        tabIndex={overflowing ? 0 : undefined}
        className="w-full overflow-x-auto rounded-card border border-hairline bg-surface-raised"
      >
        <table
          {...props}
          // display:block drops table semantics in some browsers, so stacked tables restate them.
          role={stackOnMobile ? "table" : undefined}
          className={cx("w-full border-collapse text-left text-body-sm", stackOnMobile && "max-md:block", className)}
        >
          <caption
            className={cx(
              showCaption ? "px-4 pb-1 pt-4 text-left text-body-sm font-semibold text-ink" : "sr-only",
              stackOnMobile && showCaption && "max-md:block",
            )}
          >
            {caption}
          </caption>
          {children}
        </table>
      </div>
    </TableStackContext.Provider>
  );
}

export function TableHead({ className, ...props }: ComponentProps<"thead">) {
  const stacked = useTableStacked();
  return (
    <thead
      {...props}
      role={stacked ? "rowgroup" : undefined}
      className={cx("bg-surface-sunken", stacked && "max-md:sr-only", className)}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  const stacked = useTableStacked();
  return (
    <tbody
      {...props}
      role={stacked ? "rowgroup" : undefined}
      className={cx(
        "[&>tr:last-child>td]:border-b-0",
        stacked && "max-md:flex max-md:flex-col",
        className,
      )}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  const stacked = useTableStacked();
  return (
    <tr
      {...props}
      role={stacked ? "row" : undefined}
      className={cx(
        "transition-colors",
        // Divided rows, not bordered cards: a stacked table often sits inside a Card, and cards never nest.
        stacked && "max-md:flex max-md:flex-col max-md:gap-2 max-md:border-b max-md:border-hairline max-md:px-4 max-md:py-3.5 max-md:last:border-b-0",
        className,
      )}
    />
  );
}

export function TableHeaderCell({ className, scope = "col", ...props }: ComponentProps<"th">) {
  const stacked = useTableStacked();
  return (
    <th
      {...props}
      scope={scope}
      role={stacked ? "columnheader" : undefined}
      className={cx(
        "h-11 whitespace-nowrap border-b border-hairline px-4 py-2 text-left text-caption font-semibold text-ink-muted",
        className,
      )}
    />
  );
}

export interface TableCellProps extends ComponentProps<"td"> {
  /** Column name shown beside the value when rows stack on phones. */
  label?: ReactNode;
}

export function TableCell({ label, className, children, ...props }: TableCellProps) {
  const stacked = useTableStacked();
  return (
    <td
      {...props}
      role={stacked ? "cell" : undefined}
      className={cx(
        "border-b border-hairline px-4 py-3 align-middle text-ink",
        stacked && "max-md:flex max-md:items-start max-md:justify-between max-md:gap-4 max-md:border-0 max-md:p-0",
        className,
      )}
    >
      {stacked && label && (
        <span aria-hidden className="shrink-0 font-sans text-caption font-semibold text-ink-muted md:hidden">
          {label}
        </span>
      )}
      {stacked ? <span className="min-w-0 max-md:text-right md:contents">{children}</span> : children}
    </td>
  );
}
