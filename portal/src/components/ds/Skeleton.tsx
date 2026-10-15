import type { ComponentProps } from "react";
import { cx } from "./cx";

/**
 * Placeholder shape while data loads. Hidden from assistive technology: pair it
 * with aria-busy on the region, or a Spinner, so the wait is announced once.
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden {...props} className={cx("animate-shimmer rounded-[8px] bg-border", className)} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}
