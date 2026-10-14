import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
  /** Trigger text for the current translation, whether or not the loaded list includes it. */
  currentLabel: string;
  onSelect: (abbreviation: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Translation picker. Two or more characters search the engine (debounced),
 * which also matches alias abbreviations; the full catalog (about 1,300
 * versions) is fetched only once the picker first opens.
 */
export function VersionPicker({ version, currentLabel, onSelect, disabled, className }: VersionPickerProps) {
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // SearchSelect reports "" when it clears its box on close; show the full list straight away.
  function handleQueryChange(next: string) {
    setQuery(next);
    if (!next.trim()) setDebounced("");
  }

  const serverSearch = debounced.length >= MIN_SERVER_QUERY;
  // Query keys match the previous reader, so a cached catalog is reused.
  const catalog = useQuery({
    queryKey: ["bible-versions", ""],
    queryFn: () => bible.versions(),
    staleTime: 5 * 60 * 1000,
    enabled: opened,
  });
  const search = useQuery({
    queryKey: ["bible-versions", debounced],
    queryFn: () => bible.versions(debounced),
    staleTime: 5 * 60 * 1000,
    enabled: opened && serverSearch,
  });

  const active = serverSearch ? search : catalog;
  const options = useMemo(() => (active.data ?? []).map(toOption), [active.data]);
  const selected = options.find((o) => o.value.toUpperCase() === version)?.value ?? version;
  const typingAhead = query.trim() !== debounced;

  let emptyMessage = "No translations match that search.";
  if (active.isError) {
    emptyMessage =
      active.error instanceof ApiError && active.error.status === 429
        ? rateLimitMessage(active.error)
        : "Couldn't load translations. Close the list and try again.";
  }

  return (
    <div className={className}>
      <SearchSelect
        aria-label="Translation"
        options={options}
        value={selected}
        selectedLabel={currentLabel}
        onValueChange={onSelect}
        onOpenChange={(open) => open && setOpened(true)}
        placeholder="Choose a translation"
        searchLabel="Search translations"
        searchPlaceholder="Name or abbreviation"
        emptyMessage={emptyMessage}
        onQueryChange={handleQueryChange}
        // One character filters the loaded catalog here; two or more go to the server.
        filterOptions={!serverSearch && !typingAhead}
        loading={active.isPending || active.isFetching || (typingAhead && query.trim().length >= MIN_SERVER_QUERY)}
        disabled={disabled}
      />
    </div>
  );
}
