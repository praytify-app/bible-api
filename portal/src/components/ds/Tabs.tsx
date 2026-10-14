import { Tabs as RadixTabs } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Radix Tabs: arrow keys move between tabs, Home and End jump, tabpanels are linked. */
export const Tabs = RadixTabs.Root;

export interface TabsListProps extends ComponentProps<typeof RadixTabs.List> {
  /** pill: segmented control on a sunken track. underline: section tabs over a hairline. */
  variant?: "pill" | "underline";
}

export function TabsList({ variant = "pill", className, ...props }: TabsListProps) {
  return (
    <RadixTabs.List
      {...props}
      data-variant={variant}
      className={cx(
        "group/tabs flex",
        variant === "pill"
          ? "w-fit max-w-full gap-1 overflow-x-auto rounded-pill bg-surface-sunken p-1"
          : "gap-5 overflow-x-auto border-b border-hairline",
        className,
      )}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      {...props}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-body-sm font-semibold text-ink-secondary",
        "transition-colors duration-150 hover:text-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        // pill
        "group-data-[variant=pill]/tabs:touch-target group-data-[variant=pill]/tabs:min-h-9 group-data-[variant=pill]/tabs:rounded-pill group-data-[variant=pill]/tabs:px-4",
        "group-data-[variant=pill]/tabs:data-[state=active]:bg-surface-raised group-data-[variant=pill]/tabs:data-[state=active]:text-ink group-data-[variant=pill]/tabs:data-[state=active]:shadow-raised",
        // underline
        "group-data-[variant=underline]/tabs:-mb-px group-data-[variant=underline]/tabs:min-h-11 group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent",
        "group-data-[variant=underline]/tabs:data-[state=active]:border-accent group-data-[variant=underline]/tabs:data-[state=active]:text-ink",
        className,
      )}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content {...props} className={cx("mt-4", className)} />;
}
