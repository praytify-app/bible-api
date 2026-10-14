import { Popover as RadixPopover } from "radix-ui";
import type { ComponentProps } from "react";
import { cx } from "./cx";
import { overlaySurface } from "./styles";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

export function PopoverContent({
  className,
  sideOffset = 8,
  collisionPadding = 8,
  align = "start",
  ...props
}: ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        align={align}
        {...props}
        className={cx(overlaySurface, "w-72 max-w-[calc(100vw-1rem)] p-4", className)}
      />
    </RadixPopover.Portal>
  );
}
