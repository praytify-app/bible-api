import { LoaderCircle } from "lucide-react";
import { cx } from "./cx";
import { VisuallyHidden } from "./VisuallyHidden";

const sizes = { sm: "size-4", md: "size-5", lg: "size-8" } as const;

export interface SpinnerProps {
  size?: keyof typeof sizes;
  /** Announced to screen readers. */
  label?: string;
  /** Inside a control that already reports busy state (Button loading): render the icon only. */
  decorative?: boolean;
  className?: string;
}

export function Spinner({ size = "md", label = "Loading", decorative = false, className }: SpinnerProps) {
  // data-motion="essential" keeps it turning under reduced motion; a frozen spinner reads as a hang.
  const icon = (
    <LoaderCircle aria-hidden data-motion="essential" className={cx("shrink-0 animate-spin", sizes[size], className)} />
  );
  if (decorative) return icon;
  return (
    <span role="status" className="inline-flex items-center text-ink-muted">
      {icon}
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
