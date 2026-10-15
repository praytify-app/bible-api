import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  Field,
  Input,
  PageHeader,
  SearchSelect,
  Select,
  Switch,
  VisuallyHidden,
  type SearchSelectOption,
} from "@/components/ds";
import { useTheme } from "@/lib/theme";
import { API_URL, ApiError, bible, type BibleVersion } from "@/lib/api";
import { versionSlug } from "@/lib/version-slug";
import { AccentField } from "./AccentField";
import {
  configFromSearch,
  configToSearch,
  normalizeReference,
  type EmbedConfig,
  type WidgetTheme,
  type WidgetType,
} from "./config";
import { htmlSnippet, reactSnippet, sdkSnippet, widgetAttributes, widgetTag, type SnippetEnv } from "./snippets";
import { useDebouncedValue } from "./use-debounced-value";
import { WIDGET_PATH } from "./load-widget";
import { WidgetPreview } from "./WidgetPreview";

const TYPE_OPTIONS: { value: WidgetType; label: string }[] = [
  { value: "passage", label: "A passage" },
  { value: "daily", label: "Verse of the day" },
];

const THEME_OPTIONS: { value: WidgetTheme; label: string }[] = [
  { value: "auto", label: "Match the visitor's device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Typing pauses this long before the preview, probe and URL follow.
const REFERENCE_DEBOUNCE_MS = 450;
const VERSION_SEARCH_DEBOUNCE_MS = 250;
const CATALOG_STALE_MS = 5 * 60_000;

function versionOption(version: BibleVersion): SearchSelectOption {
  return {
    value: versionSlug(version),
    label: version.abbreviation.trim() === version.name.trim() ? version.name : `${version.name} (${version.abbreviation})`,
    description: version.language ?? undefined,
    keywords: [version.abbreviation, version.code, version.languageCode].filter(Boolean).join(" "),
  };
}

// ApiError carries the API's own words. Anything else is the network (fetch
// throws a bare TypeError), which reads better in plain language.
function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not reach the Bible API. Check the connection and try again.";
}

const verseCount = (n: number) => `${n} ${n === 1 ? "verse" : "verses"}`;

export interface EmbedBuilderProps {
  /** Inside the dashboard shell rather than the public site. */
  inDashboard?: boolean;
}

export function EmbedBuilder({ inDashboard = false }: EmbedBuilderProps) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();

  const [initial] = useState(() => configFromSearch(search));
  const [settings, setSettings] = useState<Omit<EmbedConfig, "reference">>(initial);
  const [referenceDraft, setReferenceDraft] = useState(initial.reference);
  const [pageTheme, setPageTheme] = useState<"light" | "dark" | null>(null);
  const [versionQuery, setVersionQuery] = useState("");
  // The full catalog is large in production, so it loads when the picker first opens.
  const [catalogWanted, setCatalogWanted] = useState(false);

  // The reference follows the text box once typing pauses, so the probe, the
  // preview and the URL do not fire on every keystroke.
  const reference = normalizeReference(useDebouncedValue(referenceDraft, REFERENCE_DEBOUNCE_MS));
  const settledVersionQuery = useDebouncedValue(versionQuery.trim(), VERSION_SEARCH_DEBOUNCE_MS);
  // The engine searches from two characters; shorter queries filter the full
  // list in the picker. So do results still on their way: until they land, the
  // previous list is on screen, and Enter must not pick an unfiltered row.
  const serverQuery = settledVersionQuery.length >= 2 ? settledVersionQuery : "";

  const versionInfo = useQuery({
    queryKey: ["bible", "version", settings.version],
    queryFn: () => bible.version(settings.version),
    staleTime: CATALOG_STALE_MS,
  });
  const versions = useQuery({
    queryKey: ["bible", "versions", serverQuery],
    queryFn: () => bible.versions(serverQuery || undefined),
    enabled: catalogWanted,
    placeholderData: keepPreviousData,
    staleTime: CATALOG_STALE_MS,
  });

  // `?version=web` works, but the widget and snippet carry the catalog's
  // spelling, as a URL-safe slug rather than a title with spaces.
  const version = versionInfo.data ? versionSlug(versionInfo.data) : settings.version;
  const config: EmbedConfig = { ...settings, version, reference };

  const passage = useQuery({
    queryKey: ["bible", "passage", reference, version],
    queryFn: () => bible.passage(reference, version),
    enabled: config.type === "passage" && reference !== "",
    staleTime: CATALOG_STALE_MS,
  });
  const daily = useQuery({
    queryKey: ["bible", "daily", version],
    queryFn: () => bible.daily(version),
    enabled: config.type === "daily",
  });

  // Keep the URL in step so a reload or a shared link restores the builder.
  const searchKey = JSON.stringify(configToSearch(config));
  useEffect(() => {
    void navigate({ to: ".", search: JSON.parse(searchKey), replace: true, resetScroll: false });
  }, [navigate, searchKey]);

  const env: SnippetEnv = useMemo(() => {
    const origin = window.location.origin;
    return { scriptSrc: new URL(WIDGET_PATH, origin).href, apiUrl: API_URL, readerUrl: origin };
  }, []);
  const snippets = [
    { label: "HTML", language: "html", code: htmlSnippet(config, env) },
    { label: "React", language: "jsx", code: reactSnippet(config, env) },
    { label: "SDK", language: "ts", code: sdkSnippet(config, env) },
  ];

  const versionOptions = useMemo(() => (versions.data ?? []).map(versionOption), [versions.data]);
  // Named from the version lookup, so the trigger reads right before the
  // catalog loads and while a search excludes the current choice.
  const versionLabel = versionInfo.data ? versionOption(versionInfo.data).label : version;

  const update = (patch: Partial<Omit<EmbedConfig, "reference">>) => setSettings((s) => ({ ...s, ...patch }));
  const stage = pageTheme ?? resolvedTheme;
  const versionName = versionInfo.data?.name ?? version;

  let referenceStatus = "";
  let referenceError: string | undefined;
  if (config.type === "passage") {
    if (referenceDraft.trim() === "") referenceError = "Enter a reference, such as John 3:16 or Psalm 23.";
    else if (normalizeReference(referenceDraft) !== reference) referenceStatus = "Checking the reference…";
    else if (passage.isError) referenceError = errorMessage(passage.error);
    else if (passage.isFetching) referenceStatus = "Checking the reference…";
    else if (passage.data) {
      referenceStatus = `Found ${passage.data.reference} (${passage.data.version}), ${verseCount(passage.data.verses.length)}.`;
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Embed builder"
        title="Scripture on any page"
        serifLine="in two lines of HTML."
        description="Pick a passage or the verse of the day, check it in the live widget, then copy the code."
      />

      <div className="@container">
        <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Card as="section" aria-labelledby="embed-content-title">
              <CardHeader title={<span id="embed-content-title">What to show</span>} />
              <div className="flex flex-col gap-5">
                <Field label="Widget">
                  <Select
                    options={TYPE_OPTIONS}
                    value={config.type}
                    onValueChange={(value) => update({ type: value as WidgetType })}
                  />
                </Field>

                {config.type === "passage" && (
                  <Field
                    label="Reference"
                    hint={referenceError ? "Book, chapter and verses, like Romans 8:28-30." : referenceStatus || undefined}
                    error={referenceError}
                    required
                  >
                    <Input
                      value={referenceDraft}
                      onChange={(event) => setReferenceDraft(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                )}
                {/* Announces the probe result; the visible copy is the hint above. */}
                <VisuallyHidden role="status">{referenceStatus.startsWith("Found") ? referenceStatus : ""}</VisuallyHidden>

                <Field
                  label="Translation"
                  hint={
                    versionInfo.data
                      ? [versionInfo.data.language, versionInfo.data.license].filter(Boolean).join(" · ") || undefined
                      : undefined
                  }
                  error={
                    versionInfo.isError
                      ? errorMessage(versionInfo.error)
                      : versions.isError
                        ? `Could not load the translation list. ${errorMessage(versions.error)}`
                        : undefined
                  }
                >
                  <SearchSelect
                    options={versionOptions}
                    value={version}
                    selectedLabel={versionLabel}
                    onValueChange={(value) => update({ version: value })}
                    onOpenChange={(open) => open && setCatalogWanted(true)}
                    searchLabel="Search translations"
                    searchPlaceholder="Name, language or abbreviation"
                    emptyMessage="No translation matches that search."
                    onQueryChange={setVersionQuery}
                    filterOptions={serverQuery === "" || versions.isPlaceholderData}
                    loading={versions.isFetching}
                  />
                </Field>
                {versions.isError && (
                  <Button variant="secondary" size="sm" className="self-start" onClick={() => void versions.refetch()}>
                    Retry loading translations
                  </Button>
                )}

                {config.type === "daily" && (
                  <p className="text-body-sm text-ink-secondary" role="status">
                    {daily.isError
                      ? `The verse of the day did not load: ${errorMessage(daily.error)}`
                      : daily.data
                        ? `Today it shows ${daily.data.reference} (${daily.data.version}). It changes every day.`
                        : "Checking today's verse…"}
                    {daily.data?.note && ` ${daily.data.note}`}
                  </p>
                )}
              </div>
            </Card>

            <Card as="section" aria-labelledby="embed-appearance-title">
              <CardHeader title={<span id="embed-appearance-title">Appearance</span>} />
              <div className="flex flex-col gap-4">
                <Field label="Theme" hint="The widget draws its own background, so it reads on any page.">
                  <Select
                    options={THEME_OPTIONS}
                    value={config.theme}
                    onValueChange={(value) => update({ theme: value as WidgetTheme })}
                  />
                </Field>
                <div className="flex flex-col divide-y divide-hairline">
                  <Switch
                    label="Chapter link"
                    description="Adds “Read the chapter” under the text."
                    checked={config.link}
                    onCheckedChange={(checked) => update({ link: checked })}
                  />
                  <Switch
                    label="Attribution"
                    description="Credits the translation under the text."
                    checked={config.attribution}
                    onCheckedChange={(checked) => update({ attribution: checked })}
                  />
                </div>
                {!config.attribution && (
                  <Alert tone="warning" title="Check the licence first">
                    Many translations require attribution as a licence condition.
                    {versionInfo.data?.license
                      ? ` ${versionName} is licensed as: ${versionInfo.data.license}.`
                      : ` The catalog lists no licence for ${versionName}.`}{" "}
                    Only turn this off if your page credits the translation itself.
                  </Alert>
                )}
                <AccentField
                  accent={config.accent}
                  theme={config.theme}
                  onAccentChange={(accent) => update({ accent })}
                />
              </div>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Card as="section" aria-labelledby="embed-preview-title">
              <CardHeader
                title={<span id="embed-preview-title">Preview</span>}
                description="The real widget, reading from the live API."
                actions={
                  <Switch
                    label="Dark page"
                    checked={stage === "dark"}
                    onCheckedChange={(checked) => setPageTheme(checked ? "dark" : "light")}
                  />
                }
              />
              <div data-theme={stage} className="rounded-input border border-hairline bg-surface p-4 @lg:p-8">
                <WidgetPreview
                  tag={widgetTag(config)}
                  attributes={widgetAttributes(config, env, { explicit: true })}
                  accent={config.accent}
                />
              </div>
            </Card>

            <section aria-labelledby="embed-code-title" className="flex flex-col gap-3">
              <h2 id="embed-code-title" className="text-h3 font-semibold text-ink">
                Add it to your site
              </h2>
              <p className="max-w-measure text-body-sm text-ink-secondary">
                No API key needed: the widget reads the public API and renders in a shadow root, so your styles cannot
                break it. Running your own gateway? Point the <code className="font-mono">api</code> attribute at it.
              </p>
              <CodeBlock tabs={snippets} />
              <p className="text-body-sm text-ink-secondary">
                Need search or higher limits?{" "}
                {inDashboard ? (
                  <Link to="/dashboard/keys" className="font-semibold text-accent-text underline underline-offset-2">
                    Create an API key
                  </Link>
                ) : (
                  <Link to="/login" className="font-semibold text-accent-text underline underline-offset-2">
                    Sign in for an API key
                  </Link>
                )}
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
