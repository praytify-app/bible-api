import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, Button, Card, EmptyState, Eyebrow, IconButton, SkeletonText, Spinner } from "@/components/ds";
import { PUBLIC_SEARCH_KEY, bible, type BibleBook } from "@/lib/api";
import { BookChapterPickersRow } from "@/features/reader/BookChapterPickers";
import { ChapterBody } from "@/features/reader/ChapterBody";
import { adjacentChapters, resolveVersionSwitch, sortBooks } from "@/features/reader/chapter-nav";
import { isNotFound, isRateLimited, rateLimitMessage, retryUnlessFinal } from "@/features/reader/errors";
import { useChapterShortcuts } from "@/features/reader/keyboard";
import { rememberLocation } from "@/features/reader/last-read";
import { ReaderSearch } from "@/features/reader/ReaderSearch";
import { ReadingSettings } from "@/features/reader/ReadingSettings";
import { parseVerseParam } from "@/features/reader/selection";
import { useReaderSettings } from "@/features/reader/settings";
import { readerPath } from "@/features/reader/share";
import { VersionPicker } from "@/features/reader/VersionPicker";

/** Book names are per translation; when this one lacks the book, borrow the name from any cached list. */
function cachedBookName(client: QueryClient, bookCode: string): string | undefined {
  for (const [, books] of client.getQueriesData<BibleBook[]>({ queryKey: ["bible-books"] })) {
    const hit = books?.find((b) => b.bookCode === bookCode);
    if (hit) return hit.name;
  }
  return undefined;
}

/**
 * Public Bible reader. No account or key: it reads the gateway's public routes.
 * URL: /read/$version/$book/$chapter (abbreviation, USFM code, number), with
 * an optional `?v=16` or `?v=16-18` that selects and scrolls to verses.
 */
export function ReadPage() {
  const params = useParams({ strict: false }) as { version?: string; book?: string; chapter?: string };
  const search = useSearch({ strict: false }) as { v?: unknown };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const version = (params.version ?? "WEB").toUpperCase();
  const bookCode = (params.book ?? "JHN").toUpperCase();
  const chapter = Math.max(1, Number.parseInt(params.chapter ?? "1", 10) || 1);
  const linkedRange = useMemo(() => parseVerseParam(search.v), [search.v]);
  const [settings, updateSettings] = useReaderSettings();

  // Scripture never changes under a URL, so it is cached for the session.
  const versionQuery = useQuery({
    queryKey: ["bible-version", version],
    queryFn: () => bible.version(version),
    staleTime: Infinity,
    retry: retryUnlessFinal,
  });
  const booksQuery = useQuery({
    queryKey: ["bible-books", version],
    queryFn: () => bible.books(version),
    staleTime: Infinity,
    retry: retryUnlessFinal,
  });
  const versesQuery = useQuery({
    queryKey: ["bible-verses", version, bookCode, chapter],
    queryFn: () => bible.chapterVerses(version, bookCode, chapter),
    staleTime: Infinity,
    retry: retryUnlessFinal,
  });

  const detail = versionQuery.data;
  const books = booksQuery.data;
  const currentBook = books?.find((b) => b.bookCode === bookCode);
  const bookName = currentBook?.name ?? cachedBookName(queryClient, bookCode) ?? bookCode;
  const versionName = detail?.name ?? version;
  const dir = detail?.textDirection === "rtl" ? "rtl" : "ltr";
  const lang = detail?.languageCode ?? undefined;
  const { prev, next } = useMemo(
    () => (books ? adjacentChapters(books, bookCode, chapter) : { prev: null, next: null }),
    [books, bookCode, chapter],
  );

  const goTo = useCallback(
    (v: string, book: string, ch: number) =>
      navigate({ to: "/read/$version/$book/$chapter", params: { version: v, book, chapter: String(ch) } }),
    [navigate],
  );
  const goPrev = prev ? () => void goTo(version, prev.book.bookCode, prev.chapter) : undefined;
  const goNext = next ? () => void goTo(version, next.book.bookCode, next.chapter) : undefined;
  useChapterShortcuts({ prev: goPrev, next: goNext });

  useEffect(() => {
    const previous = document.title;
    document.title = `${bookName} ${chapter} (${version}) · Praytify Bible`;
    return () => {
      document.title = previous;
    };
  }, [bookName, chapter, version]);

  // Only a chapter that actually rendered becomes the place /read resumes.
  const loadedChapter = versesQuery.isSuccess && versesQuery.data.length > 0;
  useEffect(() => {
    if (loadedChapter) rememberLocation({ version, book: bookCode, chapter });
  }, [loadedChapter, version, bookCode, chapter]);

  // Switching translation keeps the book and chapter when the new one has them.
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchNote, setSwitchNote] = useState<{ path: string; text: string } | null>(null);
  const currentPath = readerPath(version, bookCode, chapter).toUpperCase();

  async function switchVersion(abbreviation: string) {
    if (abbreviation.toUpperCase() === version) return;
    setSwitchingTo(abbreviation);
    setSwitchError(null);
    try {
      const nextBooks = await queryClient.fetchQuery({
        queryKey: ["bible-books", abbreviation.toUpperCase()],
        queryFn: () => bible.books(abbreviation),
        staleTime: Infinity,
      });
      const target = resolveVersionSwitch(nextBooks, bookCode, chapter);
      if (!target) {
        setSwitchError(`${abbreviation} has no books available yet, so you are still reading ${version}.`);
        return;
      }
      if (target.fallback) {
        const landing = nextBooks.find((b) => b.bookCode === target.bookCode)?.name ?? target.bookCode;
        setSwitchNote({
          path: readerPath(abbreviation, target.bookCode, target.chapter).toUpperCase(),
          text: `${abbreviation} does not include ${bookName} ${chapter}, so you are at ${landing} ${target.chapter}.`,
        });
      } else {
        setSwitchNote(null);
      }
      await goTo(abbreviation, target.bookCode, target.chapter);
    } catch (error) {
      setSwitchError(
        isRateLimited(error)
          ? rateLimitMessage(error)
          : `Couldn't load the book list for ${abbreviation}, so you are still reading ${version}. Try again.`,
      );
    } finally {
      setSwitchingTo(null);
    }
  }

  function renderBody(): ReactNode {
    if (versionQuery.isError && isNotFound(versionQuery.error)) {
      return (
        <Alert
          tone="warning"
          title={`There is no translation called “${version}”`}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/read/$version/$book/$chapter" params={{ version: "WEB", book: "JHN", chapter: "3" }}>
                Read John 3 in WEB
              </Link>
            </Button>
          }
        >
          Choose a translation from the list above.
        </Alert>
      );
    }
    if (books && books.length === 0) {
      return <EmptyState titleAs="h2" title={`${versionName} has no books yet`} description="Choose another translation from the list above." />;
    }
    if (books && !currentBook) {
      const first = sortBooks(books).find((b) => b.chapterCount > 0);
      return (
        <EmptyState
          titleAs="h2"
          title={`${versionName} does not include ${bookName}`}
          description="Some translations cover only part of the Bible. Pick another book or translation above."
          action={
            first && (
              <Button asChild variant="secondary">
                <Link to="/read/$version/$book/$chapter" params={{ version, book: first.bookCode, chapter: "1" }}>
                  Start at {first.name} 1
                </Link>
              </Button>
            )
          }
        />
      );
    }
    if (currentBook && chapter > currentBook.chapterCount) {
      return (
        <EmptyState
          titleAs="h2"
          title={`${bookName} has ${currentBook.chapterCount} ${currentBook.chapterCount === 1 ? "chapter" : "chapters"} in ${version}`}
          action={
            <Button asChild variant="secondary">
              <Link
                to="/read/$version/$book/$chapter"
                params={{ version, book: bookCode, chapter: String(currentBook.chapterCount) }}
              >
                Go to {bookName} {currentBook.chapterCount}
              </Link>
            </Button>
          }
        />
      );
    }
    // A 404 while the book list is still loading is probably a missing book; wait to say which.
    if (versesQuery.isError && !(isNotFound(versesQuery.error) && booksQuery.isPending)) {
      const error = versesQuery.error;
      return (
        <Alert
          tone="danger"
          title={`We couldn't load ${bookName} ${chapter} in ${version}.`}
          action={
            <Button variant="secondary" size="sm" onClick={() => void versesQuery.refetch()}>
              Try again
            </Button>
          }
        >
          {isRateLimited(error)
            ? rateLimitMessage(error)
            : isNotFound(error)
              ? "This chapter is missing from this translation. Try another book or translation."
              : "Check your connection, then try again."}
        </Alert>
      );
    }
    if (!versesQuery.isSuccess) {
      return (
        <div aria-busy="true">
          <p role="status" className="sr-only">
            Loading {bookName} {chapter}
          </p>
          <SkeletonText lines={12} />
        </div>
      );
    }
    if (versesQuery.data.length === 0) {
      return <EmptyState titleAs="h2" title={`${version} has no verses for ${bookName} ${chapter}`} />;
    }
    return (
      <ChapterBody
        key={`${version}/${bookCode}/${chapter}/${String(search.v ?? "")}`}
        verses={versesQuery.data}
        version={version}
        bookCode={bookCode}
        bookName={bookName}
        chapter={chapter}
        linkedRange={linkedRange}
        settings={settings}
        lang={lang}
        dir={dir}
        attribution={detail?.attribution ?? detail?.license}
        attributionUrl={detail?.attributionUrl}
      />
    );
  }

  const chapterArrows = (
    <div className="flex shrink-0 items-center gap-1.5" dir="ltr">
      <IconButton label="Previous chapter" icon={<ChevronLeft />} variant="secondary" disabled={!goPrev} onClick={goPrev} />
      <IconButton label="Next chapter" icon={<ChevronRight />} variant="secondary" disabled={!goNext} onClick={goNext} />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <Card as="section" aria-label="Reader controls" padding="sm" className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <VersionPicker
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            version={version}
            currentLabel={detail ? `${detail.abbreviation} · ${detail.name}` : version}
            onSelect={(abbreviation) => void switchVersion(abbreviation)}
            disabled={switchingTo !== null}
          />
          <div className="flex items-center gap-1.5 sm:order-last">
            {PUBLIC_SEARCH_KEY && <ReaderSearch version={version} versionName={versionName} />}
            <ReadingSettings settings={settings} onChange={updateSettings} />
          </div>
          <BookChapterPickersRow
            books={books}
            currentBook={currentBook}
            bookCode={bookCode}
            bookName={bookName}
            chapter={chapter}
            booksFailed={booksQuery.isError}
            onBook={(code) => void goTo(version, code, 1)}
            onChapter={(ch) => void goTo(version, bookCode, ch)}
            trailing={chapterArrows}
          />
        </div>

        {switchingTo && (
          <p role="status" className="mt-3 flex items-center gap-2 text-body-sm text-ink-secondary">
            <Spinner size="sm" decorative /> Opening {switchingTo}
          </p>
        )}
        {switchError && (
          <Alert tone="danger" className="mt-3" onDismiss={() => setSwitchError(null)}>
            {switchError}
          </Alert>
        )}
        {booksQuery.isError && (
          <Alert
            tone="warning"
            className="mt-3"
            action={
              <Button variant="secondary" size="sm" onClick={() => void booksQuery.refetch()}>
                Try again
              </Button>
            }
          >
            {isRateLimited(booksQuery.error)
              ? rateLimitMessage(booksQuery.error)
              : `Couldn't load the book list for ${version}, so book and chapter navigation is unavailable.`}
          </Alert>
        )}
      </Card>

      {switchNote && switchNote.path === currentPath && (
        <Alert tone="info" className="mb-6" onDismiss={() => setSwitchNote(null)}>
          {switchNote.text}
        </Alert>
      )}

      <article aria-labelledby="reader-chapter-title">
        {/* No synthetic italic: scripts the serif lacks (Arabic, Hebrew) fall back upright. */}
        <header className="mb-8">
          <Eyebrow as="p">{versionName}</Eyebrow>
          <h1 id="reader-chapter-title" lang={lang} dir={dir} className="mt-2 font-serif text-h1 font-medium italic text-ink [font-synthesis:none]">
            {bookName} {chapter}
          </h1>
        </header>

        {renderBody()}

        <footer className="mt-12 border-t border-hairline pt-6 text-caption text-ink-muted">
          {versionQuery.isError && !isNotFound(versionQuery.error) ? (
            <Alert
              tone="warning"
              action={
                <Button variant="secondary" size="sm" onClick={() => void versionQuery.refetch()}>
                  Try again
                </Button>
              }
            >
              Couldn't load the details for {version}, so its licence attribution and text direction are missing here.
            </Alert>
          ) : detail ? (
            <Attribution
              attribution={detail.attribution}
              attributionUrl={detail.attributionUrl}
              license={detail.license}
              lang={lang}
            />
          ) : null}
        </footer>
      </article>

      <nav aria-label="Chapters" dir="ltr" className="mt-10 flex flex-wrap items-center justify-between gap-3">
        {prev ? (
          <Button asChild variant="secondary" leadingIcon={<ChevronLeft aria-hidden />}>
            <Link
              to="/read/$version/$book/$chapter"
              params={{ version, book: prev.book.bookCode, chapter: String(prev.chapter) }}
            >
              <span className="sr-only">Previous: </span>
              <bdi>{prev.book.name}</bdi> {prev.chapter}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button asChild variant="secondary" trailingIcon={<ChevronRight aria-hidden />}>
            <Link
              to="/read/$version/$book/$chapter"
              params={{ version, book: next.book.bookCode, chapter: String(next.chapter) }}
            >
              <span className="sr-only">Next: </span>
              <bdi>{next.book.name}</bdi> {next.chapter}
            </Link>
          </Button>
        )}
      </nav>

      <p className="mt-12 text-center text-caption text-ink-muted">
        Building an app?{" "}
        <Link to="/docs/quickstart" className="text-accent-text underline-offset-4 hover:underline">
          Use this text through the free API
        </Link>
      </p>
    </div>
  );
}

function Attribution({
  attribution,
  attributionUrl,
  license,
  lang,
}: {
  attribution?: string | null;
  attributionUrl?: string | null;
  license?: string | null;
  lang?: string;
}) {
  if (!attribution && !license) {
    return <p>No attribution or licence details are recorded for this translation.</p>;
  }
  return (
    <div className="space-y-1">
      {attribution && (
        <p lang={lang} dir="auto">
          {attribution}
          {attributionUrl && (
            <>
              {" "}
              <a
                href={attributionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text underline underline-offset-2"
              >
                Source
              </a>
            </>
          )}
        </p>
      )}
      {license && license !== attribution && <p dir="auto">Licence: {license}</p>}
    </div>
  );
}
