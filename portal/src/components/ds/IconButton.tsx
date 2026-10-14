import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { buttonVariants } from "./styles";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

const sizes = {
  sm: "touch-target size-9 [&_svg]:size-4",
  md: "size-11 [&_svg]:size-5",
} as const;

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children" | "aria-label"> {
  /** Required accessible name. Icon-only controls have no other text. */
  label: string;
  icon: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: keyof typeof sizes;
  loading?: boolean;
  /** Also show the label as a hover/focus tooltip. */
  showTooltip?: boolean;
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  showTooltip = false,
  className,
  type,
  onClick,
  ...props
}: IconButtonProps) {
  const button = (
    <button
      {...props}
      type={type ?? "button"}
      aria-label={label}
      aria-busy={loading || undefined}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      onClick={loading ? (event) => event.preventDefault() : onClick}
      className={cx(
        "inline-flex shrink-0 items-center justify-center transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        buttonVariants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Spinner size="sm" decorative /> : icon}
    </button>
  );
  return showTooltip ? <Tooltip content={label}>{button}</Tooltip> : button;
}
