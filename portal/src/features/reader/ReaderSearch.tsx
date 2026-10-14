import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Dialog, DialogClose, DialogContent, DialogTrigger, Field, IconButton, Input, Spinner } from "@/components/ds";
import { ApiError, bible } from "@/lib/api";
import { AppLink } from "./AppLink";
import { rateLimitMessage, retryUnlessFinal } from "./errors";
import { readerPath } from "./share";

const MIN_QUERY = 2;

function searchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) return rateLimitMessage(error);
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return "Search is not available from this address. The site's search key does not allow it.";
  }
  return "Search failed. Check your connection and try again.";
}

/**
 * Full-text search in the current translation. The engine requires a key for
 * search, so this only renders when the build has a publishable key
 * (VITE_PUBLIC_SEARCH_KEY) restricted to the portal's origin.
 */
export function ReaderSearch({ version, versionName }: { version: string; versionName: string }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const enabled = debounced.length >= MIN_QUERY;
  const results = useQuery({
    queryKey: ["bible-search", version, debounced],
    queryFn: ({ signal }) => bible.search(debounced, version, signal),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: retryUnlessFinal,
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton label={`Search ${version}`} icon={<Search />} variant="secondary" />
      </DialogTrigger>
      <DialogContent title={`Search ${versionName}`} description="Find verses by words or phrases." size="md">
        <Field label="Words to find" hideLabel>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="love one another"
            leadingIcon={<Search />}
            autoComplete="off"
          />
        </Field>

        <div className="mt-4 min-h-24" aria-busy={results.isFetching || undefined}>
          {!enabled ? (
            <p className="text-body-sm text-ink-muted">Type at least two letters.</p>
          ) : results.isError ? (
            <Alert tone="danger">{searchErrorMessage(results.error)}</Alert>
          ) : results.isPending ? (
            <p className="flex items-center gap-2 text-body-sm text-ink-muted">
              <Spinner size="sm" decorative /> Searching
            </p>
          ) : results.data.length === 0 ? (
            <p className="text-body-sm text-ink-secondary">No verses in {version} match “{debounced}”.</p>
          ) : (
            <ul className="-mx-2 max-h-[50vh] space-y-1 overflow-y-auto" aria-label="Search results">
              {results.data.map((hit) => (
                <li key={hit.id}>
                  <DialogClose asChild>
                    <AppLink
                      href={readerPath(hit.versionAbbreviation || version, hit.bookCode, hit.chapterNumber, {
                        start: hit.verseNumber,
                        end: hit.verseNumber,
                      })}
                      className="block rounded-input px-2 py-2 text-ink no-underline hover:bg-surface-sunken"
                    >
                      <span className="block text-body-sm font-semibold text-accent-text">
                        {hit.bookName} {hit.chapterNumber}:{hit.verseNumber}
                      </span>
                      <span dir="auto" className="line-clamp-2 font-serif text-body text-ink-secondary">
                        {hit.text}
                      </span>
                    </AppLink>
                  </DialogClose>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p role="status" className="sr-only">
          {enabled && results.isSuccess
            ? `${results.data.length} ${results.data.length === 1 ? "result" : "results"}`
            : ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
