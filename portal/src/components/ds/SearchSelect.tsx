import { Check, ChevronDown, Search } from "lucide-react";
import { Popover as RadixPopover } from "radix-ui";
import { useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "./cx";
import { FieldContext } from "./field-context";
import { controlBase, overlaySurface } from "./styles";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Second line, e.g. the language of a translation. Also searched. */
  description?: string;
  /** Extra terms to match that are not shown, e.g. an abbreviation or language code. */
  keywords?: string;
}

export interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  /**
   * Rows rendered at once. The list filters on every keystroke, so a cap keeps
   * 1,000+ options responsive on a phone without a virtualisation dependency.
   */
  maxResults?: number;
  disabled?: boolean;
  id?: string;
  /** Needed when not inside a Field. */
  "aria-label"?: string;
  className?: string;
}

const count = new Intl.NumberFormat();

// Case- and accent-insensitive, so "genese" finds "Genèse" and "reina" finds "Reina-Valera".
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function SearchSelect({
  options,
  value,
  onValueChange,
  placeholder = "Choose…",
  searchLabel = "Search",
  searchPlaceholder = "Type to filter",
  emptyMessage = "Nothing matches that search.",
  maxResults = 50,
  disabled,
  id,
  className,
  ...aria
}: SearchSelectProps) {
  const field = useContext(FieldContext);
  const generated = useId();
  const baseId = id ?? field?.id ?? `search-select${generated}`;
  const listboxId = `${baseId}-listbox`;
  const valueId = `${baseId}-value`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const index = useMemo(
    () =>
      options.map((option) => ({
        option,
        haystack: normalize([option.label, option.description, option.keywords].filter(Boolean).join(" ")),
      })),
    [options],
  );
  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    return needle ? index.filter((entry) => entry.haystack.includes(needle)).map((entry) => entry.option) : options;
  }, [index, options, query]);
  const visible = matches.slice(0, maxResults);
  const selected = options.find((option) => option.value === value) ?? null;

  // Keep the keyboard-active row on screen. DOM-only, no state.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("[data-active]")?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setQuery("");
      const selectedIndex = value ? options.findIndex((option) => option.value === value) : -1;
      setActive(selectedIndex >= 0 && selectedIndex < maxResults ? selectedIndex : 0);
    }
  }

  function choose(option: SearchSelectOption) {
    onValueChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option);
    }
  }

  // The trigger's name is the field label plus the current value, so a screen
  // reader hears "Version, World English Bible" rather than the label alone.
  const labelling = field
    ? { "aria-labelledby": `${field.labelId} ${valueId}` }
    : { "aria-label": aria["aria-label"] ? `${aria["aria-label"]}: ${selected?.label ?? placeholder}` : undefined };

  return (
    <RadixPopover.Root open={open} onOpenChange={handleOpenChange}>
      <RadixPopover.Trigger
        id={baseId}
        disabled={disabled ?? field?.disabled}
        aria-haspopup="dialog"
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        {...labelling}
        className={cx(controlBase, "flex items-center justify-between gap-2 text-left", className)}
      >
        <span id={valueId} className={cx("min-w-0 truncate", !selected && "text-ink-muted")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-muted" />
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className={cx(
            overlaySurface,
            "flex w-[max(var(--radix-popover-trigger-width),18rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden",
          )}
        >
          <div className="relative border-b border-hairline p-2">
            <Search aria-hidden className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              role="combobox"
              aria-label={searchLabel}
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={visible.length ? optionId(active) : undefined}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-[10px] bg-surface-sunken pl-9 pr-3 text-body text-ink placeholder:text-ink-muted"
            />
          </div>
          <ul ref={listRef} id={listboxId} role="listbox" aria-label={searchLabel} className="max-h-72 overflow-y-auto p-1">
            {visible.map((option, i) => {
              const isSelected = option.value === value;
              const isActive = i === active;
              return (
                <li
                  key={option.value}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isActive ? "" : undefined}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(option)}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-1.5 sm:min-h-10",
                    isActive && "bg-accent-subtle",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cx("truncate text-body-sm", isActive ? "text-accent-text" : "text-ink")}>
                      {option.label}
                    </span>
                    {option.description && <span className="truncate text-caption text-ink-muted">{option.description}</span>}
                  </span>
                  {isSelected && <Check aria-hidden className="size-4 shrink-0 text-accent-text" />}
                </li>
              );
            })}
          </ul>
          <p role="status" className="border-t border-hairline px-3 py-2 text-caption text-ink-muted empty:hidden">
            {matches.length === 0
              ? emptyMessage
              : matches.length > visible.length
                ? `Showing ${count.format(visible.length)} of ${count.format(matches.length)}. Keep typing to narrow the list.`
                : `${count.format(matches.length)} ${matches.length === 1 ? "result" : "results"}`}
          </p>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
