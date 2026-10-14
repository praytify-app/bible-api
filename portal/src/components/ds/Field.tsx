import { CircleAlert } from "lucide-react";
import { useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";
import { FieldContext, joinIds } from "./field-context";
import { controlBase } from "./styles";

export interface FieldProps {
  label: ReactNode;
  /** Persistent guidance under the control. Linked with aria-describedby. */
  hint?: ReactNode;
  /** Validation message. Sets aria-invalid on the control and is read with it. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Keep the label for assistive technology but hide it visually (a search box with a visible icon). */
  hideLabel?: boolean;
  /** Override the generated control id. */
  id?: string;
  className?: string;
  /** One control: Input, TextArea, Select, SearchSelect, or a custom control using useFieldControl(). */
  children: ReactNode;
}

export function Field({ label, hint, error, required, disabled, hideLabel, id, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? `field${generated}`;
  const labelId = `${controlId}-label`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{ id: controlId, labelId, describedBy: joinIds(errorId, hintId), invalid: Boolean(error), required, disabled }}
    >
      <div className={cx("flex flex-col gap-1.5", className)}>
        <label id={labelId} htmlFor={controlId} className={cx("text-body-sm font-semibold text-ink", hideLabel && "sr-only")}>
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-caption text-ink-muted">
            {hint}
          </p>
        )}
        {/* The live region stays mounted so a new error is announced when it appears. */}
        <div aria-live="polite">
          {error && (
            <p id={errorId} className="flex items-start gap-1.5 text-caption font-medium text-danger">
              <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>
      </div>
    </FieldContext.Provider>
  );
}

/** Props a control takes from its Field, letting its own props win. */
function useControlProps(own: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: ComponentProps<"input">["aria-invalid"];
  required?: boolean;
  disabled?: boolean;
}) {
  const field = useContext(FieldContext);
  return {
    id: own.id ?? field?.id,
    "aria-describedby": joinIds(field?.describedBy, own["aria-describedby"]),
    "aria-invalid": own["aria-invalid"] ?? (field?.invalid ? true : undefined),
    required: own.required ?? field?.required,
    disabled: own.disabled ?? field?.disabled,
  };
}

export interface InputProps extends ComponentProps<"input"> {
  /** Decorative icon inside the start of the field (a search glass). */
  leadingIcon?: ReactNode;
}

export function Input({ className, leadingIcon, ...props }: InputProps) {
  const wired = useControlProps(props);
  const input = (
    <input {...props} {...wired} className={cx(controlBase, leadingIcon ? "pl-10" : undefined, className)} />
  );
  if (!leadingIcon) return input;
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-ink-muted [&_svg]:size-4"
      >
        {leadingIcon}
      </span>
      {input}
    </div>
  );
}

export function TextArea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  const wired = useControlProps(props);
  return <textarea rows={rows} {...props} {...wired} className={cx(controlBase, "resize-y py-2.5 leading-normal", className)} />;
}
