import type { ComponentProps } from "react";
import { cx } from "./cx";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      {...props}
      className={cx(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border border-border bg-surface-raised px-1.5",
        "font-mono text-caption text-ink-secondary shadow-[inset_0_-1px_0_var(--border)]",
        className,
      )}
    />
  );
}
