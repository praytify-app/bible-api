import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { IconButton } from "./IconButton";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" } as const;

export interface DialogContentProps extends Omit<ComponentProps<typeof RadixDialog.Content>, "title"> {
  /** Required: every dialog is announced by its title. */
  title: ReactNode;
  description?: ReactNode;
  /** Buttons. Stacked full width on phones, right-aligned from sm up. */
  footer?: ReactNode;
  size?: keyof typeof widths;
}

export function DialogContent({ title, description, footer, size = "md", className, children, ...props }: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <RadixDialog.Content
        // Radix links a Description automatically; without one, opt out explicitly.
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
        className={cx(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-panel border border-hairline bg-surface-overlay text-ink shadow-dialog",
          "data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out",
          widths[size],
          className,
        )}
      >
        <div className="px-6 pb-2 pr-14 pt-6 sm:px-8 sm:pr-16 sm:pt-7">
          <div className="flex min-w-0 flex-col gap-1.5">
            <RadixDialog.Title className="text-h3 font-semibold text-ink">{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="text-body-sm text-ink-secondary">{description}</RadixDialog.Description>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-3 border-t border-hairline px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
            {footer}
          </div>
        )}
        {/* Last in DOM order so focus starts on the dialog's first field; placed top-right visually. */}
        <span className="absolute right-4 top-4 sm:right-5 sm:top-5">
          <RadixDialog.Close asChild>
            <IconButton label="Close" icon={<X />} size="sm" />
          </RadixDialog.Close>
        </span>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
