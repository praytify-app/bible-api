import { Switch as RadixSwitch } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";

type RootProps = Omit<ComponentProps<typeof RadixSwitch.Root>, "children" | "asChild">;

export type SwitchProps = RootProps &
  ({ label: ReactNode; description?: ReactNode } | { label?: undefined; description?: undefined; "aria-label": string });

export function Switch({ label, description, className, id, ...props }: SwitchProps) {
  const generated = useId();
  const controlId = id ?? `switch${generated}`;
  const descriptionId = description ? `${controlId}-description` : undefined;

  // Off track uses the control colour so the switch edge reaches 3:1 against the surface.
  const control = (
    <RadixSwitch.Root
      {...props}
      id={controlId}
      aria-describedby={descriptionId}
      className={cx(
        "touch-target inline-flex h-6 w-11 shrink-0 items-center rounded-pill bg-control p-0.5 transition-colors",
        "data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        !label && className,
      )}
    >
      <RadixSwitch.Thumb className="block size-5 rounded-pill bg-on-accent shadow-raised transition-transform duration-150 data-[state=checked]:translate-x-5" />
    </RadixSwitch.Root>
  );
  if (!label) return control;

  return (
    <div className={cx("flex min-h-11 items-center justify-between gap-4 py-2", className)}>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={controlId} className="cursor-pointer text-body-sm font-medium text-ink">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-caption text-ink-muted">
            {description}
          </p>
        )}
      </div>
      {control}
    </div>
  );
}
