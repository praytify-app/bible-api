import { Check, Minus } from "lucide-react";
import { Checkbox as RadixCheckbox } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";

type RootProps = Omit<ComponentProps<typeof RadixCheckbox.Root>, "children" | "asChild">;

/** A visible label, or an aria-label when the checkbox sits in a labelled context (a table row). */
export type CheckboxProps = RootProps &
  ({ label: ReactNode; description?: ReactNode } | { label?: undefined; description?: undefined; "aria-label": string });

const box =
  "touch-target peer inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 border-control " +
  "bg-surface-raised text-on-accent transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent " +
  "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generated = useId();
  const controlId = id ?? `checkbox${generated}`;
  const descriptionId = description ? `${controlId}-description` : undefined;

  const control = (
    <RadixCheckbox.Root
      {...props}
      id={controlId}
      aria-describedby={descriptionId}
      className={cx(box, !label && className)}
    >
      <RadixCheckbox.Indicator className="flex">
        {props.checked === "indeterminate" ? (
          <Minus aria-hidden strokeWidth={3} className="size-3.5" />
        ) : (
          <Check aria-hidden strokeWidth={3} className="size-3.5" />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
  if (!label) return control;

  return (
    <div className={cx("flex min-h-11 items-start gap-3 py-2.5", className)}>
      {control}
      <div className="flex flex-col gap-0.5 leading-5">
        <label htmlFor={controlId} className="cursor-pointer text-body-sm font-medium text-ink peer-disabled:cursor-not-allowed">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-caption text-ink-muted">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
