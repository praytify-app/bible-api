import type { ComponentProps } from "react";

/** Text for assistive technology only. Still read aloud; still part of accessible names. */
export function VisuallyHidden(props: ComponentProps<"span">) {
  return <span {...props} className="sr-only" />;
}
