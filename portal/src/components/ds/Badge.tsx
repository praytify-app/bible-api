import type { ComponentProps } from "react";
import { cx } from "./cx";

const tones = {
  neutral: "bg-surface-sunken text-ink-secondary",
  accent: "bg-accent-subtle text-accent-text",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
  info: "bg-info-subtle text-info",
} as const;

export type BadgeTone = keyof typeof tones;

export interface BadgeProps extends ComponentProps<"span"> {
  /** Colour reinforces the words; it never carries the meaning alone. */
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cx(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-caption font-semibold [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
    />
  );
}
