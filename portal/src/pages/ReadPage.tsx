import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { bible, type BibleBook } from "../lib/api";

/**
 * Public Bible reader. No account or API key required — it rides on the
 * gateway's public read routes. URL shape: /read/$version/$book/$chapter
 * (abbreviation / USFM book code / chapter number), so every passage is
 * shareable and crawlable.
 */
export function ReadPage() {
  const params = useParams({ strict: false }) as {
    version: string;
    book: string;
    chapter: string;
  };
  const navigate = useNavigate();
  const version = params.version?.toUpperCase() ?? "WEB";
  const bookCode = params.book?.toUpperCase() ?? "JHN";
  const chapterNum = parseInt(params.chapter ?? "1", 10) || 1;

  const [pickerOpen, setPickerOpen] = useState<"version" | "book" | null>(null);

  const { data: versionDetail } = useQuery({
    queryKey: ["bible-version", version],
    queryFn: () => bible.version(version),
    staleTime: Infinity,
  });

  const {
    data: books,
    isError: booksError,
  } = useQuery({
    queryKey: ["bible-books", version],
    queryFn: () => bible.books(version),
    staleTime: Infinity,
  });

  const {
    data: verses,
    isLoading: versesLoading,
    isError: versesError,
  } = useQuery({
    queryKey: ["bible-verses", version, bookCode, chapterNum],
    queryFn: () => bible.chapterVerses(version, bookCode, chapterNum),
    staleTime: Infinity,
  });

  const currentBook = useMemo(
    () => books?.find((b) => b.bookCode === bookCode),
    [books, bookCode]
  );

  const goTo = (v: string, b: string, ch: number) => {
    setPickerOpen(null);
    navigate({
      to: "/read/$version/$book/$chapter",
      params: { version: v, book: b, chapter: String(ch) },
    });
  };

  // Prev/next across book boundaries
  const nav = useMemo(() => {
    if (!books || !currentBook) return { prev: null, next: null };
    const sorted = [...books].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((b) => b.bookCode === currentBook.bookCode);
    let prev: { book: BibleBook; chapter: number } | null = null;
    let next: { book: BibleBook; chapter: number } | null = null;
    if (chapterNum > 1) {
      prev = { book: currentBook, chapter: chapterNum - 1 };
    } else if (idx > 0) {
      prev = { book: sorted[idx - 1], chapter: sorted[idx - 1].chapterCount };
    }
    if (chapterNum < currentBook.chapterCount) {
      next = { book: currentBook, chapter: chapterNum + 1 };
    } else if (idx >= 0 && idx < sorted.length - 1) {
      next = { book: sorted[idx + 1], chapter: 1 };
    }
    return { prev, next };
  }, [books, currentBook, chapterNum]);

  const dir = versionDetail?.textDirection === "rtl" ? "rtl" : "ltr";

  return (
    <div className="min-h-screen bg-white">
      {/* Reader toolbar */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setPickerOpen(pickerOpen === "version" ? null : "version")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors shrink-0"
            >
              {version}
              <Chevron open={pickerOpen === "version"} />
            </button>
            <button
              onClick={() => setPickerOpen(pickerOpen === "book" ? null : "book")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors truncate"
            >
              <span className="truncate">
                {currentBook?.name ?? bookCode} {chapterNum}
              </span>
              <Chevron open={pickerOpen === "book"} />
            </button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ChapterArrow
              label="Previous chapter"
              disabled={!nav.prev}
              onClick={() => nav.prev && goTo(version, nav.prev.book.bookCode, nav.prev.chapter)}
              direction="left"
            />
            <ChapterArrow
              label="Next chapter"
              disabled={!nav.next}
              onClick={() => nav.next && goTo(version, nav.next.book.bookCode, nav.next.chapter)}
              direction="right"
            />
          </div>
        </div>

        {pickerOpen === "version" && (
          <VersionPicker current={version} onSelect={(abbr) => goTo(abbr, bookCode, 1)} />
        )}
        {pickerOpen === "book" && (
          <BookPicker
            books={books ?? []}
            error={booksError}
            currentBookCode={bookCode}
            onSelect={(b, ch) => goTo(version, b, ch)}
          />
        )}
      </div>

      {/* Scripture */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10" dir={dir}>
        {versesError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-10 text-center">
            <p className="text-red-700 font-medium">
              We couldn't load {currentBook?.name ?? bookCode} {chapterNum} in {version}.
            </p>
            <p className="mt-1 text-sm text-red-600">
              The chapter may not exist in this translation. Try another book or
              version.
            </p>
          </div>
        ) : versesLoading ? (
          <div className="space-y-3 animate-pulse" aria-label="Loading chapter">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
            ))}
          </div>
        ) : (
          <article>
            <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1">
              {currentBook?.name ?? bookCode} {chapterNum}
            </h1>
            <p className="text-sm text-gray-500 mb-8">{versionDetail?.name ?? version}</p>
            <div className="font-serif text-lg leading-8 text-gray-800">
              {verses?.map((v) => (
                <span key={v.id ?? v.number}>
                  <sup className="text-xs font-sans font-semibold text-primary select-none">
                    {v.number}
                  </sup>{" "}
                  {v.text}{" "}
                </span>
              ))}
            </div>
            {versionDetail?.attribution && (
              <p className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400">
                {versionDetail.attribution}
                {versionDetail.attributionUrl && (
                  <>
                    {" "}
                    <a
                      href={versionDetail.attributionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-gray-600"
                    >
                      Source
                    </a>
                  </>
                )}
              </p>
            )}
          </article>
        )}

        {/* Bottom navigation */}
        <div className="mt-10 flex items-center justify-between" dir="ltr">
          {nav.prev ? (
            <button
              onClick={() => goTo(version, nav.prev!.book.bookCode, nav.prev!.chapter)}
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              ← {nav.prev.book.name} {nav.prev.chapter}
            </button>
          ) : (
            <span />
          )}
          {nav.next ? (
            <button
              onClick={() => goTo(version, nav.next!.book.bookCode, nav.next!.chapter)}
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              {nav.next.book.name} {nav.next.chapter} →
            </button>
          ) : (
            <span />
          )}
        </div>

        <p className="mt-12 text-center text-xs text-gray-400" dir="ltr">
          Building an app?{" "}
          <Link to="/docs/quickstart" className="text-primary hover:text-primary-dark no-underline">
            Use this data through the free API
          </Link>
        </p>
      </main>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChapterArrow({
  label,
  disabled,
  onClick,
  direction,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

function VersionPicker({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (abbr: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer.current);
  }, [search]);

  const { data: versions, isLoading, isError } = useQuery({
    queryKey: ["bible-versions", debounced],
    queryFn: () => bible.versions(debounced || undefined),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="border-t border-gray-100 bg-white shadow-lg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search 1,200+ translations by name or language..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-gray-50">
          {isError ? (
            <p className="py-6 text-center text-sm text-red-600">
              Couldn't load translations. Try again shortly.
            </p>
          ) : isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
          ) : versions && versions.length > 0 ? (
            versions.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v.abbreviation)}
                className={`w-full flex items-center gap-3 px-2 py-2.5 text-left hover:bg-gray-50 rounded-lg ${
                  v.abbreviation === current ? "bg-primary-50" : ""
                }`}
              >
                <code className="text-xs font-mono font-semibold text-primary w-24 shrink-0 truncate">
                  {v.abbreviation}
                </code>
                <span className="text-sm text-gray-800 truncate flex-1">{v.name}</span>
                {v.language && (
                  <span className="text-xs text-gray-400 shrink-0">{v.language}</span>
                )}
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">
              No translations match "{search}".
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BookPicker({
  books,
  error,
  currentBookCode,
  onSelect,
}: {
  books: BibleBook[];
  error: boolean;
  currentBookCode: string;
  onSelect: (bookCode: string, chapter: number) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(currentBookCode);
  const sorted = useMemo(() => [...books].sort((a, b) => a.position - b.position), [books]);

  return (
    <div className="border-t border-gray-100 bg-white shadow-lg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 max-h-96 overflow-y-auto">
        {error ? (
          <p className="py-6 text-center text-sm text-red-600">
            Couldn't load the book list for this translation.
          </p>
        ) : sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : (
          <div className="space-y-1">
            {sorted.map((b) => (
              <div key={b.id}>
                <button
                  onClick={() => setExpanded(expanded === b.bookCode ? null : b.bookCode)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-50 ${
                    b.bookCode === currentBookCode ? "font-semibold text-primary" : "text-gray-800"
                  }`}
                >
                  {b.name}
                  <span className="text-xs text-gray-400">{b.chapterCount}</span>
                </button>
                {expanded === b.bookCode && (
                  <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 px-3 py-2">
                    {Array.from({ length: b.chapterCount }, (_, i) => i + 1).map((ch) => (
                      <button
                        key={ch}
                        onClick={() => onSelect(b.bookCode, ch)}
                        className="h-9 text-sm rounded-lg border border-gray-200 text-gray-700 hover:border-primary hover:text-primary transition-colors"
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
