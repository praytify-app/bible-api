import { useId, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ds";
import { EXAMPLE_ACCENT, normalizeAccent, WIDGET_COLOURS, type WidgetTheme } from "./config";
import { accentShortfalls, formatRatio, MIN_LINK_CONTRAST } from "./contrast";

export interface AccentFieldProps {
  accent: string | null;
  theme: WidgetTheme;
  onAccentChange: (accent: string | null) => void;
}

/**
 * Optional `--pb-accent`. The text box is the source of truth (it takes a
 * pasted brand colour); the native picker beside it is a shortcut. Only a
 * valid `#rrggbb` ever reaches the widget or the snippet.
 */
export function AccentField({ accent, theme, onAccentChange }: AccentFieldProps) {
  const [draft, setDraft] = useState(accent ?? "");
  const pickerId = useId();
  const invalid = draft.trim() !== "" && normalizeAccent(draft) === null;
  const shortfalls = accent ? accentShortfalls(accent, theme) : [];

  function update(value: string) {
    setDraft(value);
    if (value.trim() === "") onAccentChange(null);
    else {
      const valid = normalizeAccent(value);
      if (valid) onAccentChange(valid);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Accent colour"
        hint="Links and the focus ring. Leave it empty to keep the widget's indigo."
        error={invalid ? `Use a six-digit hex colour, like ${EXAMPLE_ACCENT}.` : undefined}
      >
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => update(event.target.value)}
            placeholder="Default"
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
          />
          <label htmlFor={pickerId} className="sr-only">
            Pick an accent colour
          </label>
          <input
            id={pickerId}
            type="color"
            value={accent ?? WIDGET_COLOURS.light.accent.toLowerCase()}
            onChange={(event) => update(event.target.value)}
            className="h-11 w-12 shrink-0 cursor-pointer rounded-input border border-control bg-surface-raised p-1"
          />
          {accent && (
            <Button variant="ghost" size="sm" onClick={() => update("")}>
              Clear
            </Button>
          )}
        </div>
      </Field>
      {shortfalls.length > 0 && (
        <Alert tone="warning" role="status" title="Links may be hard to read">
          This colour reaches{" "}
          {shortfalls.map((s) => `${formatRatio(s.ratio)} on the ${s.background} widget`).join(" and ")}. Text links
          need {MIN_LINK_CONTRAST}:1.
          {theme === "auto" && " With the theme following the visitor's device, the colour has to work on both."}
        </Alert>
      )}
    </div>
  );
}
