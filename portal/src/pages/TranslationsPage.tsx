import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SearchSelect,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ds";
import { filterCatalog, languagesOf, pageOf } from "@/features/docs/catalog";
import { translations } from "@/lib/api";

const ALL_LANGUAGES = "all";
const count = new Intl.NumberFormat();

export function TranslationsPage() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string>(ALL_LANGUAGES);
  const [page, setPage] = useState(1);

  const catalog = useQuery({ queryKey: ["translations"], queryFn: translations.list });

  const languages = useMemo(() => languagesOf(catalog.data ?? []), [catalog.data]);
  const languageOptions = useMemo(
    () => [
      { value: ALL_LANGUAGES, label: "All languages" },
      ...languages.map((l) => ({
        value: l.code,
        label: l.name,
        description: `${count.format(l.count)} translation${l.count === 1 ? "" : "s"}`,
        keywords: l.code,
      })),
    ],
    [languages],
  );
  const filtered = useMemo(
    () => filterCatalog(catalog.data ?? [], search, language === ALL_LANGUAGES ? null : language),
    [catalog.data, search, language],
  );
  const view = pageOf(filtered, page);
  const filtering = search.trim() !== "" || language !== ALL_LANGUAGES;

  function clearFilters() {
    setSearch("");
    setLanguage(ALL_LANGUAGES);
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Docs"
        title="Translations"
        serifLine="every version in the catalog"
        description={
          // The live count appears only once the catalog has loaded (must-not-regress 8).
          catalog.isSuccess
            ? `${count.format(catalog.data.length)} translations in ${count.format(languages.length)} languages. Open one in the reader, or use its abbreviation in any API call.`
            : "Open a translation in the reader, or use its abbreviation in any API call."
        }
      />

      {catalog.isError ? (
        <Alert
          tone="danger"
          title="We could not load the translation list."
          action={
            <Button variant="secondary" size="sm" loading={catalog.isFetching} onClick={() => catalog.refetch()}>
              Try again
            </Button>
          }
        >
          The API may be unreachable. Try again in a moment.
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem]">
            <Field label="Search translations">
              <Input
                type="search"
                leadingIcon={<Search />}
                placeholder="Name, abbreviation, or language"
                value={search}
                disabled={catalog.isPending}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label="Language" disabled={catalog.isPending}>
              <SearchSelect
                options={languageOptions}
                value={language}
                onValueChange={(value) => {
                  setLanguage(value);
                  setPage(1);
                }}
                searchLabel="Search languages"
                searchPlaceholder="Type a language"
                emptyMessage="No language matches that search."
              />
            </Field>
          </div>

          <div className="flex min-h-6 flex-wrap items-center justify-between gap-3 text-body-sm text-ink-secondary">
            <span role="status">
              {catalog.isSuccess &&
                (filtered.length === 0
                  ? "No translations match."
                  : `Showing ${count.format(view.from)} to ${count.format(view.to)} of ${count.format(filtered.length)}${filtering ? " matching" : ""}`)}
            </span>
            {catalog.isSuccess && filtering && (
              <Button variant="link" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {catalog.isPending ? (
            <div aria-busy className="flex flex-col gap-2 rounded-card border border-hairline bg-surface-raised p-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
              <p className="sr-only">Loading translations</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="No translations match"
              description="Try a shorter search, another spelling, or all languages."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <Table caption="Bible translations" stackOnMobile>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Abbreviation</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Language</TableHeaderCell>
                    <TableHeaderCell>Licence</TableHeaderCell>
                    <TableHeaderCell className="text-right">Verses</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {view.rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell label="Abbreviation">
                        <Link
                          to="/read/$version/$book/$chapter"
                          params={{ version: t.abbreviation, book: "GEN", chapter: "1" }}
                          className="font-mono font-semibold text-accent-text underline-offset-4 hover:underline"
                        >
                          {t.abbreviation}
                          <span className="sr-only">, read {t.name}</span>
                        </Link>
                      </TableCell>
                      <TableCell label="Name">{t.name}</TableCell>
                      <TableCell label="Language">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span className="text-ink-secondary">{t.language || t.languageCode || "Unknown"}</span>
                          {t.textDirection === "rtl" && <Badge tone="neutral">Right to left</Badge>}
                        </span>
                      </TableCell>
                      <TableCell label="Licence" className="text-ink-secondary">
                        {t.license || "Not stated"}
                      </TableCell>
                      <TableCell label="Verses" className="text-right tabular-nums text-ink-secondary">
                        {typeof t.verseCount === "number" ? count.format(t.verseCount) : "Not available"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {view.pages > 1 && (
                <nav aria-label="Translation pages" className="flex items-center justify-between gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<ChevronLeft aria-hidden />}
                    disabled={view.page === 1}
                    onClick={() => setPage(view.page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-body-sm text-ink-secondary">
                    Page {view.page} of {view.pages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    trailingIcon={<ChevronRight aria-hidden />}
                    disabled={view.page === view.pages}
                    onClick={() => setPage(view.page + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
