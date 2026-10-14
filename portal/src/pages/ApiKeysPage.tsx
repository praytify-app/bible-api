import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, ConfirmDialog, Dialog, PageHeader } from "@/components/ds";
import { CreateKeyDialog } from "@/features/keys/CreateKeyDialog";
import { EditKeyDialog } from "@/features/keys/EditKeyDialog";
import { KeyList } from "@/features/keys/KeyList";
import { RevealPanel } from "@/features/keys/RevealPanel";
import { isExpired, kindOf, KIND_INFO } from "@/features/keys/kinds";
import {
  useKeyUsage,
  useKeys,
  usePlan,
  useRevokeKey,
  useRollKey,
  type KeyMeta,
  type Revealed,
} from "@/features/keys/queries";
import { useNow } from "@/features/keys/use-now";

/** Keeps the last target while a dialog animates closed, so its text does not blank out mid-fade. */
interface DialogTarget {
  open: boolean;
  key: KeyMeta | null;
}
const closed: DialogTarget = { open: false, key: null };

function subjectOf(key: KeyMeta | null) {
  if (!key) return "";
  return (
    <>
      {key.name} <span className="font-mono font-normal text-ink-secondary">({key.prefix})</span>
    </>
  );
}

/** A row's actions button, to hand focus back after a dialog it opened closes. */
function rowActions(id: string | undefined): HTMLElement | null {
  if (!id) return null;
  return document.querySelector<HTMLElement>(`[data-key-id="${CSS.escape(id)}"] [data-row-actions]`);
}

function focusInstead(event: Event, target: HTMLElement | null | undefined) {
  if (!target) return;
  event.preventDefault();
  target.focus();
}

export function ApiKeysPage() {
  const keysQuery = useKeys();
  const now = useNow();
  const planQuery = usePlan();
  const usageQuery = useKeyUsage();

  // The one-time key. Plain component state: it dies with this page or on dismiss.
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const focusReveal = useRef(false);
  const revealHeading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSession, setCreateSession] = useState(0);
  const [edit, setEdit] = useState<DialogTarget>(closed);
  const [roll, setRoll] = useState<DialogTarget>(closed);
  const [revoke, setRevoke] = useState<DialogTarget>(closed);
  const revoked = useRef(false);

  const reveal = useCallback((next: Revealed) => {
    focusReveal.current = true;
    setRevealed(next);
  }, []);
  const rollMutation = useRollKey(reveal);
  const revokeMutation = useRevokeKey();

  // True from opening a create or roll dialog until its close has handed focus
  // on. While set, the dialog's onCloseAutoFocus owns moving focus to a new key.
  const dialogBusy = useRef(false);
  // A create or roll that finished after its dialog had already closed.
  useEffect(() => {
    if (revealed && focusReveal.current && !dialogBusy.current) {
      focusReveal.current = false;
      revealHeading.current?.focus();
      revealHeading.current?.scrollIntoView({ block: "nearest" });
    }
  }, [revealed]);

  function closeToReveal(event: Event, fallback: HTMLElement | null) {
    dialogBusy.current = false;
    if (focusReveal.current && revealHeading.current) {
      focusReveal.current = false;
      focusInstead(event, revealHeading.current);
    } else {
      focusInstead(event, fallback);
    }
  }

  const keyList = keysQuery.data;
  const plan = planQuery.data;
  // The gateway's limit counts keys that are neither revoked nor expired.
  const activeCount = keyList?.filter((k) => !isExpired(k, now)).length;
  const atLimit = plan && activeCount !== undefined && activeCount >= plan.maxKeys;

  function openCreate() {
    dialogBusy.current = true;
    setCreateSession((n) => n + 1);
    setCreateOpen(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="API keys"
        serifLine="one for servers, one for browsers"
        description="Secret keys stay on your server. Publishable keys go in web pages and only work on the sites you allow. You see each key in full once, when it is created or rolled."
        actions={
          <Button ref={createButton} leadingIcon={<Plus />} onClick={openCreate}>
            Create key
          </Button>
        }
      />

      {plan && activeCount !== undefined && (
        <p className="-mt-4 text-body-sm text-ink-secondary">
          {activeCount} of {plan.maxKeys} active keys on your account.
        </p>
      )}

      {atLimit && (
        <Alert tone="warning" role="none" title="You are at the key limit">
          Revoke a key you no longer use before creating another, or roll an existing key to replace it.
        </Alert>
      )}

      {revealed && (
        <RevealPanel
          revealed={revealed}
          headingRef={revealHeading}
          onDismiss={() => {
            setRevealed(null);
            createButton.current?.focus();
          }}
        />
      )}

      <KeyList
        keys={keyList}
        isLoading={keysQuery.isPending}
        error={keysQuery.error}
        onRetry={() => void keysQuery.refetch()}
        usage={{ data: usageQuery.data, isLoading: usageQuery.isPending, isError: usageQuery.isError }}
        onCreate={openCreate}
        onEdit={(key) => setEdit({ open: true, key })}
        onRoll={(key) => {
          dialogBusy.current = true;
          setRoll({ open: true, key });
        }}
        onRevoke={(key) => {
          revoked.current = false;
          setRevoke({ open: true, key });
        }}
        headingRef={listHeading}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        {createSession > 0 && (
          <CreateKeyDialog
            key={createSession}
            plan={plan}
            onCreated={reveal}
            onDone={() => setCreateOpen(false)}
            onCloseAutoFocus={(event) => closeToReveal(event, createButton.current)}
          />
        )}
      </Dialog>

      <Dialog open={edit.open} onOpenChange={(open) => setEdit((s) => ({ ...s, open }))}>
        {edit.key && (
          <EditKeyDialog
            key={edit.key.id}
            target={edit.key}
            onDone={() => setEdit((s) => ({ ...s, open: false }))}
            onCloseAutoFocus={(event) => focusInstead(event, rowActions(edit.key?.id) ?? listHeading.current)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={roll.open}
        onOpenChange={(open) => setRoll((s) => ({ ...s, open }))}
        title="Roll this key?"
        subject={subjectOf(roll.key)}
        description={
          roll.key && (
            <>
              You get a new {KIND_INFO[kindOf(roll.key)].label.toLowerCase()} key with the same name
              {kindOf(roll.key) === "publishable" ? ", allowed origins," : ""} and lifetime.{" "}
              <strong className="font-semibold text-ink">The old key stops working immediately</strong>, so update
              everything that uses it right after.
            </>
          )
        }
        confirmLabel="Roll key"
        onConfirm={() => (roll.key ? rollMutation.mutateAsync(roll.key) : undefined)}
        onCloseAutoFocus={(event) => closeToReveal(event, rowActions(roll.key?.id) ?? listHeading.current)}
      />

      <ConfirmDialog
        open={revoke.open}
        onOpenChange={(open) => setRevoke((s) => ({ ...s, open }))}
        title="Revoke this key?"
        subject={subjectOf(revoke.key)}
        description="Requests that use it start failing with 401 right away. This cannot be undone; create a new key if you need access again."
        confirmLabel="Revoke key"
        onConfirm={() =>
          revoke.key
            ? revokeMutation.mutateAsync(revoke.key.id).then(() => {
                revoked.current = true;
              })
            : undefined
        }
        onCloseAutoFocus={(event) =>
          focusInstead(event, revoked.current ? listHeading.current : rowActions(revoke.key?.id))
        }
      />
    </div>
  );
}
