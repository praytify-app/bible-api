import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FocusEvent } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ds";
import { ApiError, bible, type BibleVersion } from "@/lib/api";
import { rateLimitMessage } from "./errors";

const SEARCH_DEBOUNCE_MS = 250;
// The engine rejects shorter searches (400), so one letter filters the loaded list instead.
const MIN_SERVER_QUERY = 2;

function toOption(v: BibleVersion): SearchSelectOption {
  return {
    value: v.abbreviation,
    label: `${v.abbreviation} · ${v.name}`,
    description: v.language ?? undefined,
    keywords: v.languageCode ?? undefined,
  };
}

export interface VersionPickerProps {
  version: string;
  /** Names the current translation before the catalog loads, and while a search excludes it. */
  currentLabel: string;
  onSelect: (abbreviation: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Translation picker. Two or more characters search the engine (debounced),
 * which also matches alias abbreviations; the full catalog (about 1,300
 * versions) is fetched only once the picker is first focused or pressed.
 */
export function VersionPicker({ version, currentLabel, onSelect, disabled, className }: VersionPickerProps) {
  const [primed, setPrimed] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const serverSearch = debounced.length >= MIN_SERVER_QUERY;
  // Query keys match the previous reader, so a cached catalog is reused.
  const catalog = useQuery({
    queryKey: ["bible-versions", ""],
    queryFn: () => bible.versions(),
    staleTime: 5 * 60 * 1000,
    enabled: primed,
  });
  const search = useQuery({
    queryKey: ["bible-versions", debounced],
    queryFn: () => bible.versions(debounced),
    staleTime: 5 * 60 * 1000,
    enabled: primed && serverSearch,
  });

  const active = serverSearch ? search : catalog;
  const typingAhead = query.trim() !== debounced;

  let problem: string | null = null;
  if (active.isError) {
    problem =
      active.error instanceof ApiError && active.error.status === 429
        ? rateLimitMessage(active.error)
        : "Couldn't load translations. Close the list and try again.";
  }

  // SearchSelect labels its trigger from `options`. Before the catalog loads,
  // and when a search excludes the current translation, it is added at the
  // top so the trigger keeps naming it. A failed load is explained on that row,
  // because the list is no longer empty enough for SearchSelect's own message.
  const options = useMemo(() => {
    const loaded = (active.data ?? []).map(toOption);
    if (loaded.some((o) => o.value.toUpperCase() === version)) return loaded;
    return [{ value: version, label: currentLabel, description: problem ?? "Current translation" }, ...loaded];
  }, [active.data, version, currentLabel, problem]);
  const selected = options.find((o) => o.value.toUpperCase() === version)?.value ?? version;

  // SearchSelect empties its box each time it opens but has no open callback,
  // so the search resets when focus returns to the trigger on close. Only the
  // trigger is a DOM child here: the list is portalled, and its events reach
  // this handler through React alone. Resetting on those would re-render the
  // list between mousedown and click and lose the click.
  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    setPrimed(true);
    if (event.currentTarget.contains(event.target as Node)) {
      setQuery("");
      setDebounced("");
    }
  }

  return (
    <div className={className} onFocusCapture={handleFocus} onPointerDownCapture={() => setPrimed(true)}>
      <SearchSelect
          aria-label="Translation"
          options={options}
          value={selected}
          onValueChange={onSelect}
          placeholder="Choose a translation"
          searchLabel="Search translations"
          searchPlaceholder="Name or abbreviation"
          emptyMessage={problem ?? "No translations match that search."}
          onQueryChange={setQuery}
          // One character filters the loaded catalog here; two or more go to the server.
          filterOptions={!serverSearch && !typingAhead}
          loading={active.isFetching || (primed && typingAhead && query.trim().length >= MIN_SERVER_QUERY)}
          disabled={disabled}
        />
    </div>
  );
}
