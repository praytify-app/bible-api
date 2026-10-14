import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

export interface TooltipProps {
  /** Supplementary only: tooltips never show on touch, so nothing essential may live here. */
  content: ReactNode;
  /** One focusable element (a Button or IconButton). */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
}

export function Tooltip({ content, children, side = "top", delayDuration = 300 }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-50 max-w-64 rounded-[8px] bg-surface-inverse px-2.5 py-1.5 text-caption text-ink-inverse shadow-overlay data-[state=delayed-open]:animate-fade-in"
          >
            {content}
            <RadixTooltip.Arrow className="fill-surface-inverse" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
