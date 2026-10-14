import { AlertDialog as RadixAlertDialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A question naming the action: "Revoke this key?" */
  title: string;
  /** The exact thing affected, shown on its own line so nobody confirms the wrong one. */
  subject: ReactNode;
  /** Consequences, in plain words. */
  description?: ReactNode;
  /** The action verb: "Revoke key". Never "OK" or "Yes". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  /**
   * Return a promise (e.g. `() => mutation.mutateAsync(id)`) and the dialog shows
   * pending, closes on success, and shows the error and stays open on failure.
   * Return nothing to drive `pending` and `error` yourself.
   */
  onConfirm: () => void | Promise<unknown>;
  pending?: boolean;
  error?: string | null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong. Try again.";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  subject,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  pending = false,
  error = null,
}: ConfirmDialogProps) {
  const [ownPending, setOwnPending] = useState(false);
  const [ownError, setOwnError] = useState<string | null>(null);
  const isPending = pending || ownPending;
  const shownError = error ?? ownError;

  function handleOpenChange(next: boolean) {
    // Never close mid-request: the person would lose sight of whether it worked.
    if (!next && isPending) return;
    if (!next) setOwnError(null);
    onOpenChange(next);
  }

  async function handleConfirm() {
    setOwnError(null);
    const result = onConfirm();
    if (!result || typeof (result as Promise<unknown>).then !== "function") return;
    setOwnPending(true);
    try {
      await result;
      setOwnPending(false);
      onOpenChange(false);
    } catch (caught) {
      setOwnPending(false);
      setOwnError(messageOf(caught));
    }
  }

  return (
    <RadixAlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-fade-in" />
        <RadixAlertDialog.Content
          onEscapeKeyDown={(event) => {
            if (isPending) event.preventDefault();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-panel border border-hairline bg-surface-overlay p-6 text-ink shadow-dialog data-[state=open]:animate-pop-in sm:p-8"
        >
          <RadixAlertDialog.Title className="text-h3 font-semibold">{title}</RadixAlertDialog.Title>
          <p className="break-words rounded-input bg-surface-sunken px-3.5 py-2.5 text-body-sm font-semibold text-ink">
            {subject}
          </p>
          <RadixAlertDialog.Description className="text-body-sm text-ink-secondary">
            {description ?? "This cannot be undone."}
          </RadixAlertDialog.Description>
          {shownError && (
            <Alert tone="danger" title="That did not work">
              {shownError}
            </Alert>
          )}
          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {/* Cancel takes initial focus (Radix AlertDialog default), so Enter never confirms by accident. */}
            <RadixAlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={isPending}>
                {cancelLabel}
              </Button>
            </RadixAlertDialog.Cancel>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={isPending} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
