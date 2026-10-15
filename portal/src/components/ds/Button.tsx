import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cx } from "./cx";
import { Spinner } from "./Spinner";
import { buttonVariants, type ButtonVariant } from "./styles";

export type { ButtonVariant };
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold " +
  "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 " +
  "aria-disabled:cursor-not-allowed data-[loading]:cursor-progress [&_svg]:shrink-0";

// sm is 36px to sit in dense rows, with an invisible 44px hit area (touch-target).
const sizes: Record<ButtonSize, string> = {
  sm: "touch-target h-9 gap-1.5 px-3.5 text-body-sm [&_svg]:size-4",
  md: "h-11 gap-2 px-5 text-body-sm [&_svg]:size-4",
  lg: "h-13 gap-2 px-6 text-body [&_svg]:size-5",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and ignores clicks while keeping focus (a disabled button would drop it). */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /** Render the child element (a TanStack <Link>, an <a>) with button styling. */
  asChild?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  asChild = false,
  className,
  children,
  onClick,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const handleClick = loading ? (event: MouseEvent<HTMLButtonElement>) => event.preventDefault() : onClick;

  return (
    <Comp
      {...props}
      // Default to "button" so a Button inside a form never submits by accident.
      type={asChild ? undefined : (type ?? "button")}
      onClick={handleClick}
      aria-busy={loading || undefined}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      data-loading={loading ? "" : undefined}
      className={cx(base, buttonVariants[variant], variant !== "link" && sizes[size], className)}
    >
      {loading ? <Spinner size={size === "lg" ? "md" : "sm"} decorative /> : leadingIcon}
      <Slot.Slottable>{children}</Slot.Slottable>
      {trailingIcon}
    </Comp>
  );
}
