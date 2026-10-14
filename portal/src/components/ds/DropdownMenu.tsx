import { Check } from "lucide-react";
import { DropdownMenu as RadixMenu, Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { menuItem, overlaySurface } from "./styles";

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;
export const DropdownMenuGroup = RadixMenu.Group;
export const DropdownMenuRadioGroup = RadixMenu.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  ...props
}: ComponentProps<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        {...props}
        className={cx(overlaySurface, "min-w-52 p-1", className)}
      />
    </RadixMenu.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<typeof RadixMenu.Item> {
  icon?: ReactNode;
  /** danger: destructive actions (Revoke). Still confirm them with ConfirmDialog. */
  tone?: "default" | "danger";
}

/**
 * With `asChild`, the child (a TanStack <Link>) becomes the menu item, so menus
 * navigate with real hrefs. Slottable merges the icon into that child, with or
 * without an icon.
 */
export function DropdownMenuItem({ icon, tone = "default", className, children, ...props }: DropdownMenuItemProps) {
  return (
    <RadixMenu.Item
      {...props}
      className={cx(
        menuItem,
        tone === "danger" && "text-danger data-[highlighted]:bg-danger-subtle data-[highlighted]:text-danger",
        className,
      )}
    >
      {icon ? (
        <span aria-hidden className="inline-flex">
          {icon}
        </span>
      ) : null}
      <Slot.Slottable>{children}</Slot.Slottable>
    </RadixMenu.Item>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof RadixMenu.RadioItem>) {
  return (
    <RadixMenu.RadioItem {...props} className={cx(menuItem, "pr-9", className)}>
      {children}
      <RadixMenu.ItemIndicator className="absolute right-3 inline-flex">
        <Check aria-hidden className="text-accent-text" />
      </RadixMenu.ItemIndicator>
    </RadixMenu.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof RadixMenu.Label>) {
  return <RadixMenu.Label {...props} className={cx("px-3 pb-1 pt-2 text-caption font-semibold text-ink-muted", className)} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof RadixMenu.Separator>) {
  return <RadixMenu.Separator {...props} className={cx("my-1 h-px bg-hairline", className)} />;
}
