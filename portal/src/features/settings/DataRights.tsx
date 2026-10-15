import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Alert, Button, ConfirmDialog, Field, Input } from "@/components/ds";
import { account, ApiError } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth";

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Download a copy of your data, or delete the account and everything tied to it. */
export function DataRights() {
  const { data: session } = useSession();
  const email = session?.user?.email ?? "";

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<"done" | "failed" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  async function handleExport() {
    setExporting(true);
    setExportResult(null);
    try {
      const { blob, filename } = await account.exportData();
      saveBlob(blob, filename);
      setExportResult("done");
    } catch {
      setExportResult("failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (typed.trim().toLowerCase() !== email.toLowerCase()) {
      throw new Error("Type your account email exactly to confirm.");
    }
    try {
      await account.remove(typed.trim());
    } catch (err) {
      throw new Error(err instanceof ApiError ? err.message : "We could not delete your account. Please try again.", {
        cause: err,
      });
    }
    // The session no longer exists server-side; clear the local one and leave
    // with a full reload so no cached dashboard data survives.
    await signOut().catch(() => {});
    window.location.assign("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-body text-ink-secondary">
          Download everything we hold about your account: profile, linked sign-in providers, sessions, keys, and usage. Key
          secrets and sign-in tokens are never included.
        </p>
        {exportResult === "done" && <Alert tone="success">Your data file has been downloaded.</Alert>}
        {exportResult === "failed" && (
          <Alert tone="danger">We could not prepare your data file. Check your connection and try again.</Alert>
        )}
        <div>
          <Button variant="secondary" leadingIcon={<Download aria-hidden />} loading={exporting} onClick={handleExport}>
            Download my data
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-hairline pt-6">
        <p className="text-body text-ink-secondary">
          Deleting your account removes it with its API keys, usage history, and profile. Keys stop working immediately.
          This cannot be undone.
        </p>
        <div>
          <Button
            variant="danger"
            leadingIcon={<Trash2 aria-hidden />}
            onClick={() => {
              setTyped("");
              setConfirmOpen(true);
            }}
          >
            Delete account
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete your account?"
        subject={email}
        description={
          <div className="flex flex-col gap-3">
            <p>Your API keys stop working now, and your usage history and profile are erased. This cannot be undone.</p>
            <Field label="Type your account email to confirm" required>
              <Input
                type="email"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={email}
              />
            </Field>
          </div>
        }
        confirmLabel="Delete account"
        tone="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}
