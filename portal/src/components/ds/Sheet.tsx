import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";

/** A side drawer (mobile navigation, filters). Built on Dialog: focus is trapped and Escape closes it. */
export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

export interface SheetContentProps extends Omit<ComponentProps<typeof RadixDialog.Content>, "title"> {
  title: ReactNode;
  /** Keep the title for screen readers but hide it, e.g. when the logo heads the sheet. */
  hideTitle?: boolean;
  description?: ReactNode;
  side?: "left" | "right";
  /** Rendered beside the close button in the sheet header (a Logo). */
  header?: ReactNode;
}

export function SheetContent({
  title,
  hideTitle,
  description,
  side = "left",
  header,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <RadixDialog.Content
        // Radix links a Description automatically; without one, opt out explicitly.
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
        className={cx(
          "fixed inset-y-0 z-50 flex h-dvh w-[min(22rem,88vw)] flex-col bg-surface-overlay text-ink shadow-dialog",
          side === "left"
            ? "left-0 border-r border-hairline data-[state=open]:animate-sheet-in-left"
            : "right-0 border-l border-hairline data-[state=open]:animate-sheet-in-right",
          "data-[state=closed]:animate-fade-out",
          className,
        )}
      >
        <div className="flex min-h-16 items-center gap-3 border-b border-hairline py-2 pl-4 pr-16">
          <div className="min-w-0">
            {header}
            <RadixDialog.Title className={cx("text-h4 font-semibold", hideTitle && "sr-only")}>{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="text-caption text-ink-muted">{description}</RadixDialog.Description>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {/* Last in DOM order so focus starts on the sheet's first link; placed top-right visually. */}
        <RadixDialog.Close asChild>
          <IconButton label="Close" icon={<X />} className="absolute right-2.5 top-2.5" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
