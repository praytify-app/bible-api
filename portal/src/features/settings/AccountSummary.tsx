import { useState } from "react";
import { LogOut } from "lucide-react";
import { Alert, Button } from "@/components/ds";
import { useSignOut } from "@/components/shell/use-sign-out";
import { useSession } from "@/lib/auth";

export function AccountSummary() {
  const { data: session } = useSession();
  const signOut = useSignOut();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setFailed(false);
    try {
      // Returns to / on success (must-not-regress 15).
      await signOut();
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  const user = session?.user;
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-body-sm font-semibold text-ink-muted">Name</dt>
          <dd className="break-words text-ink">{user?.name || "Not set"}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-body-sm font-semibold text-ink-muted">Email</dt>
          <dd className="break-words text-ink">{user?.email}</dd>
        </div>
      </dl>
      {failed && <Alert tone="danger">We could not sign you out. Check your connection and try again.</Alert>}
      <div>
        <Button variant="secondary" leadingIcon={<LogOut aria-hidden />} loading={pending} onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
