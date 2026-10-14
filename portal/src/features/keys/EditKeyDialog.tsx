import { useId, useMemo, useState, type FormEvent } from "react";
import { Alert, Button, DialogClose, DialogContent, Field, Input } from "@/components/ds";
import { ApiError } from "@/lib/api";
import { kindOf } from "./kinds";
import { originRows, type OriginRow } from "./origin-rows";
import { OriginsEditor } from "./OriginsEditor";
import { checkOriginRows } from "./origins";
import { useUpdateKey, type KeyMeta } from "./queries";

export interface EditKeyDialogProps {
  target: KeyMeta;
  onDone: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Rename any key; edit origins on publishable keys. Sends only what changed. */
export function EditKeyDialog({ target, onDone, onCloseAutoFocus }: EditKeyDialogProps) {
  const formId = useId();
  const publishable = kindOf(target) === "publishable";
  const original = target.allowedOrigins ?? [];
  const [name, setName] = useState(target.name);
  const [nameError, setNameError] = useState<string>();
  const [rows, setRows] = useState<OriginRow[]>(() => originRows(original));
  const [attempted, setAttempted] = useState(false);
  const update = useUpdateKey();

  const check = useMemo(() => checkOriginRows(rows.map((row) => row.value)), [rows]);
  const error = update.error;
  const originError =
    error instanceof ApiError && error.code === "INVALID_REQUEST" && /origin/i.test(error.message) ? error.message : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (update.isPending) return;
    setAttempted(true);
    const trimmed = name.trim();
    setNameError(trimmed ? undefined : "Give the key a name.");
    if (!trimmed || (publishable && !check.valid)) return;

    const patch: { name?: string; allowedOrigins?: string[] } = {};
    if (trimmed !== target.name) patch.name = trimmed;
    if (publishable && !sameList(check.patterns, original)) patch.allowedOrigins = check.patterns;
    if (Object.keys(patch).length === 0) return onDone();
    update.mutate({ id: target.id, patch }, { onSuccess: onDone });
  }

  return (
    <DialogContent
      title="Edit key"
      description={
        <>
          Changes apply to <span className="font-mono">{target.prefix}</span> straight away. The key itself stays the
          same.
        </>
      }
      size="lg"
      onCloseAutoFocus={onCloseAutoFocus}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Field label="Name" required error={nameError}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="off" />
        </Field>

        {publishable && (
          <OriginsEditor
            rows={rows}
            onChange={setRows}
            check={check}
            showAllErrors={attempted}
            serverError={originError}
          />
        )}

        {error && !originError && (
          <Alert tone="danger" title="Changes not saved">
            {error instanceof ApiError && error.code === "KEY_NOT_FOUND"
              ? "This key no longer exists. It may have been revoked or rolled in another tab; the list has been refreshed."
              : error.message || "Something went wrong. Try again."}
          </Alert>
        )}
      </form>
    </DialogContent>
  );
}
