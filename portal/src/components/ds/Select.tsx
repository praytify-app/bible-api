import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { useContext } from "react";
import { cx } from "./cx";
import { FieldContext, joinIds } from "./field-context";
import { controlBase, menuItem, overlaySurface } from "./styles";

export interface SelectOption {
  /** Must be a non-empty string (Radix reserves "" for clearing). */
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Submitted with a native form under this name. */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Needed when the Select is not inside a Field. */
  "aria-label"?: string;
  "aria-describedby"?: string;
  invalid?: boolean;
  className?: string;
}

/** Up to a few dozen fixed options. For long or searchable lists use SearchSelect. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Choose…",
  name,
  required,
  disabled,
  id,
  invalid,
  className,
  ...aria
}: SelectProps) {
  const field = useContext(FieldContext);
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      required={required ?? field?.required}
      disabled={disabled ?? field?.disabled}
    >
      <RadixSelect.Trigger
        id={id ?? field?.id}
        aria-label={aria["aria-label"]}
        aria-describedby={joinIds(field?.describedBy, aria["aria-describedby"])}
        aria-invalid={invalid ?? field?.invalid ?? undefined}
        className={cx(
          controlBase,
          "flex items-center justify-between gap-2 text-left data-[placeholder]:text-ink-muted",
          className,
        )}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className="text-ink-muted">
          <ChevronDown aria-hidden className="size-4" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          className={cx(
            overlaySurface,
            "max-h-[min(var(--radix-select-content-available-height),22rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden",
          )}
        >
          <RadixSelect.ScrollUpButton className="flex h-7 items-center justify-center text-ink-muted">
            <ChevronUp aria-hidden className="size-4" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cx(menuItem, "pr-9")}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="absolute right-3 inline-flex">
                  <Check aria-hidden className="text-accent-text" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex h-7 items-center justify-center text-ink-muted">
            <ChevronDown aria-hidden className="size-4" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
