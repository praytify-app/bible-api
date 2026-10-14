import { CircleCheck, Globe, Server } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { Alert, Button, DialogClose, DialogContent, Field, Input, Select, cx } from "@/components/ds";
import { ApiError, type KeyKind, type Plan } from "@/lib/api";
import { EXPIRY_CHOICES, KIND_INFO, expiresInDays, formatLimits, type ExpiryChoice } from "./kinds";
import { originRows, type OriginRow } from "./origin-rows";
import { OriginsEditor } from "./OriginsEditor";
import { checkOriginRows } from "./origins";
import { useCreateKey, type Revealed } from "./queries";

/** AUDIT must-not-regress 6: a blank name still creates a key with this name. */
export const DEFAULT_KEY_NAME = "Untitled Key";

const KIND_ICON: Record<KeyKind, typeof Server> = { secret: Server, publishable: Globe };

export interface CreateKeyDialogProps {
  plan: Plan | undefined;
  onCreated: (revealed: Revealed) => void;
  onDone: () => void;
  /** Where focus goes when the dialog closes (the page sends it to the new key). */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * The create form, rendered inside a `Dialog`. The page remounts it (via `key`)
 * each time the dialog opens, so a cancelled draft never comes back.
 */
export function CreateKeyDialog({ plan, onCreated, onDone, onCloseAutoFocus }: CreateKeyDialogProps) {
  const formId = useId();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<KeyKind>("secret");
  const [rows, setRows] = useState<OriginRow[]>(() => originRows([]));
  const [expiry, setExpiry] = useState<ExpiryChoice>("never");
  const [attempted, setAttempted] = useState(false);
  const create = useCreateKey(onCreated);

  const check = useMemo(() => checkOriginRows(rows.map((row) => row.value)), [rows]);
  const error = create.error;
  const originError =
    error instanceof ApiError && error.code === "INVALID_REQUEST" && /origin/i.test(error.message) ? error.message : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create.isPending) return;
    setAttempted(true);
    if (kind === "publishable" && !check.valid) {
      const firstBad = check.errors.findIndex(Boolean);
      const form = event.currentTarget;
      form.querySelectorAll<HTMLInputElement>("[data-origin-input]")[Math.max(firstBad, 0)]?.focus();
      return;
    }
    create.mutate(
      {
        name: name.trim() || DEFAULT_KEY_NAME,
        kind,
        allowedOrigins: kind === "publishable" ? check.patterns : undefined,
        expiresInDays: expiresInDays(expiry),
      },
      { onSuccess: onDone }
    );
  }

  return (
    <DialogContent
      title="Create an API key"
      description="Pick where the key will run. You will see the full key once, right after it is created."
      size="lg"
      onCloseAutoFocus={onCloseAutoFocus}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} loading={create.isPending}>
            Create key
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Field label="Name" hint="Something that tells you where it runs, like Production server or Church website.">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={DEFAULT_KEY_NAME}
            maxLength={80}
            autoComplete="off"
          />
        </Field>

        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1.5 text-body-sm font-semibold text-ink">Where will it run?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["secret", "publishable"] as const).map((option) => {
              const info = KIND_INFO[option];
              const Icon = KIND_ICON[option];
              const selected = kind === option;
              const limits = formatLimits(plan?.limits[option]);
              return (
                <label
                  key={option}
                  className={cx(
                    "relative flex cursor-pointer flex-col gap-1.5 rounded-card border p-4 transition-colors",
                    // The radio itself is visually hidden, so the card carries its focus outline.
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                    selected ? "border-accent bg-accent-subtle" : "border-control hover:border-ink-secondary"
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={option}
                    checked={selected}
                    onChange={() => setKind(option)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-body font-semibold text-ink">
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {info.label}
                    {selected && <CircleCheck aria-hidden className="ml-auto size-5 shrink-0 text-accent-text" />}
                  </span>
                  <span className="text-body-sm text-ink">{info.where}</span>
                  <span className="text-caption text-ink-secondary">{info.scope}</span>
                  {limits && <span className="text-caption text-ink-secondary">Your plan: {limits}.</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        {kind === "publishable" && (
          <OriginsEditor
            rows={rows}
            onChange={setRows}
            check={check}
            showAllErrors={attempted}
            serverError={originError}
          />
        )}

        <Field
          label="Expires"
          hint="An expired key stops working. Rolling it issues a new key with the same lifetime."
        >
          <Select
            options={EXPIRY_CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
            value={expiry}
            onValueChange={(value) => setExpiry(value as ExpiryChoice)}
          />
        </Field>

        {error && !originError && <CreateError error={error} maxKeys={plan?.maxKeys} />}
      </form>
    </DialogContent>
  );
}

function CreateError({ error, maxKeys }: { error: Error; maxKeys: number | undefined }) {
  if (error instanceof ApiError && error.code === "KEY_LIMIT_REACHED") {
    return (
      <Alert tone="warning" title="You are at the key limit">
        {maxKeys
          ? `Your account can have ${maxKeys} active keys. Revoke one you no longer use, or roll an existing key instead of creating a new one.`
          : error.message}
      </Alert>
    );
  }
  return (
    <Alert tone="danger" title="The key was not created">
      {error.message || "Something went wrong. Try again."}
    </Alert>
  );
}
