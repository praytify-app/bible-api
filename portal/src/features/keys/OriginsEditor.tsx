import { CircleAlert, Plus, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button, Field, IconButton, Input } from "@/components/ds";
import { newOriginRow, type OriginRow } from "./origin-rows";
import { MAX_ORIGINS, type OriginRowsResult } from "./origins";

export interface OriginsEditorProps {
  rows: OriginRow[];
  onChange: (rows: OriginRow[]) => void;
  check: OriginRowsResult;
  /** After a save attempt every row shows its error, touched or not. */
  showAllErrors: boolean;
  /** A message from the gateway about the origins, shown under the list. */
  serverError?: string;
}

export function OriginsEditor({ rows, onChange, check, showAllErrors, serverError }: OriginsEditorProps) {
  const hintId = useId();
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const focusRow = useRef<number | "add" | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  // Move focus after the rows re-render: to a new row, or to a neighbour after a removal.
  useEffect(() => {
    const target = focusRow.current;
    if (target === null) return;
    focusRow.current = null;
    if (target === "add") addButton.current?.focus();
    else inputs.current.get(target)?.focus();
  }, [rows]);

  function update(id: number, patch: Partial<OriginRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function add() {
    const row = newOriginRow();
    focusRow.current = row.id;
    onChange([...rows, row]);
  }

  function remove(index: number) {
    const next = rows.filter((_, i) => i !== index);
    focusRow.current = next[index - 1]?.id ?? next[0]?.id ?? "add";
    onChange(next);
  }

  const atCap = rows.length >= MAX_ORIGINS;
  const listError = showAllErrors ? check.listError : undefined;

  return (
    <fieldset aria-describedby={hintId} className="flex min-w-0 flex-col gap-3">
      <legend className="mb-1.5 text-body-sm font-semibold text-ink">
        Allowed origins
        <span aria-hidden className="ml-0.5 text-danger">
          *
        </span>
      </legend>
      <p id={hintId} className="-mt-1 text-caption text-ink-muted">
        The sites that may call the API with this key from a browser: <code className="font-mono">https://example.org</code>,{" "}
        <code className="font-mono">https://*.example.org</code> for its subdomains, or{" "}
        <code className="font-mono">http://localhost:5173</code> (any port: <code className="font-mono">http://localhost:*</code>)
        while you develop.
      </p>

      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const error = row.touched || showAllErrors ? check.errors[index] : undefined;
          const warning = check.errors[index] ? undefined : check.warnings[index];
          return (
            <li key={row.id} className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <Field label={`Allowed origin ${index + 1}`} hideLabel error={error} className="min-w-0 flex-1">
                  <Input
                    ref={(element) => {
                      if (element) inputs.current.set(row.id, element);
                      else inputs.current.delete(row.id);
                    }}
                    value={row.value}
                    onChange={(event) => update(row.id, { value: event.target.value })}
                    onBlur={() => row.value.trim() !== "" && update(row.id, { touched: true })}
                    placeholder="https://example.org"
                    data-origin-input=""
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-mono text-body-sm"
                  />
                </Field>
                <IconButton
                  label={`Remove origin ${index + 1}${row.value.trim() ? ` (${row.value.trim()})` : ""}`}
                  icon={<X />}
                  variant="ghost"
                  disabled={rows.length === 1}
                  onClick={() => remove(index)}
                />
              </div>
              {warning && (
                <p className="flex items-start gap-1.5 text-caption text-warning">
                  <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  <span>{warning}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <Button ref={addButton} variant="secondary" size="sm" leadingIcon={<Plus />} onClick={add} disabled={atCap}>
          Add origin
        </Button>
        <span className="text-caption text-ink-muted">
          {rows.length} of {MAX_ORIGINS}
        </span>
      </div>

      <div aria-live="polite">
        {(listError || serverError) && (
          <p className="flex items-start gap-1.5 text-caption font-medium text-danger">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>{listError ?? serverError}</span>
          </p>
        )}
      </div>
    </fieldset>
  );
}
