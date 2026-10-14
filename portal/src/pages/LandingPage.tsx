import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Button, Card, CodeBlock, Eyebrow, PageHeader, SkeletonText, type CodeSnippet } from "@/components/ds";
import { API_URL, bible, translations } from "@/lib/api";
import { GITHUB_REPO_URL, SELF_HOST_URL } from "@/lib/nav";

// Home for the Visitor persona (BRIEF §5): what this is, then proof that it
// works. Every number on the page is fetched; every claim matches README.md.

// The widget's and SDK's built-in API (packages/embed, packages/sdk). Snippets
// name the API only when this portal talks to a different one (self-hosted, local).
const HOSTED_API = "https://api.praytify.bible";
const customApi = API_URL.replace(/\/+$/, "") !== HOSTED_API;

const embedSnippet = `<script type="module" src="${window.location.origin}/embed/v1.js"></script>

<praytify-verse reference="Romans 8:28" version="WEB"${customApi ? ` api="${API_URL}"` : ""}></praytify-verse>`;

const apiSnippets: CodeSnippet[] = [
  {
    label: "cURL",
    language: "bash",
    code: `curl "${API_URL}/v1/verses?ref=John%203:16&version=WEB"`,
  },
  {
    label: "JavaScript",
    language: "javascript",
    code: `const res = await fetch("${API_URL}/v1/verses?ref=John%203:16&version=WEB");
const { data } = await res.json();

console.log(data.reference, data.verses);`,
  },
  {
    label: "SDK",
    language: "ts",
    code: `import { createClient } from "@praytify/bible";

const bible = createClient(${customApi ? `{ baseUrl: "${API_URL}" }` : ""});
const passage = await bible.passage("John 3:16-18", { version: "WEB" });`,
  },
];

// Verbatim from the README's self-host section.
const selfHostSnippet = `git clone ${GITHUB_REPO_URL}.git praytify-bible && cd praytify-bible
docker compose up -d
docker compose --profile seed run --rm seed`;

const startingPassages = [
  { label: "Psalm 23", book: "PSA", chapter: "23" },
  { label: "John 1", book: "JHN", chapter: "1" },
  { label: "Romans 8", book: "ROM", chapter: "8" },
  { label: "Matthew 5", book: "MAT", chapter: "5" },
];

const numberFormat = new Intl.NumberFormat();

export function LandingPage() {
  return (
    <div className="mx-auto max-w-content px-4 sm:px-6">
      <Hero />
      <Section index="01" eyebrow="Read" spacing="open">
        <SectionText
          title="Open a chapter in seconds."
          body="Pick a translation, choose a book, and read. The reader works on a phone, keeps your place, follows your light or dark setting, and reads right to left where the language does."
          action={
            <Button asChild trailingIcon={<ArrowRight aria-hidden />}>
              <Link to="/read">Start reading</Link>
            </Button>
          }
        />
        <div className="flex flex-col gap-3">
          <Eyebrow as="p">Start with a passage</Eyebrow>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {startingPassages.map((passage) => (
              <li key={passage.book}>
                <Link
                  to="/read/$version/$book/$chapter"
                  params={{ version: "WEB", book: passage.book, chapter: passage.chapter }}
                  className="group flex min-h-14 items-center justify-between gap-4 px-1 font-serif text-h3 italic text-ink transition-colors hover:text-accent-text"
                >
                  {passage.label}
                  <span className="flex items-center gap-2 font-sans text-caption not-italic text-ink-muted">
                    World English Bible
                    <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section index="02" eyebrow="Embed" spacing="dense" flip>
        <SectionText
          title="Put a verse on any page with one tag."
          body="No key, no build step, no framework. The widget follows each visitor's light or dark preference, links to the full chapter, and shows the translation's attribution."
          action={
            <Button asChild variant="secondary" trailingIcon={<ArrowRight aria-hidden />}>
              <Link to="/embed">Open the embed builder</Link>
            </Button>
          }
        />
        <CodeBlock code={embedSnippet} language="html" label="HTML" />
      </Section>

      <Section index="03" eyebrow="API" spacing="open">
        <SectionText
          title="Ask for a passage, get JSON back."
          body="Public reads need no key: translations, books, chapters, references, and the verse of the day. A key adds full-text search, whole-Bible downloads, and a quota of your own."
          action={
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild variant="secondary">
                <Link to="/docs/quickstart">Read the quick start</Link>
              </Button>
              <Button asChild variant="link">
                <Link to="/docs">API reference</Link>
              </Button>
            </div>
          }
        />
        <CodeBlock tabs={apiSnippets} />
      </Section>

      <DecisionPanel />

      <Section index="04" eyebrow="Open source" spacing="dense" flip>
        <SectionText
          title="Run the whole thing yourself."
          body="The code is MIT licensed. One Docker Compose file brings up Postgres, the engine, the gateway, and this portal. Scripture is different: each translation keeps its own licence, recorded with its text."
          action={
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild variant="secondary" trailingIcon={<ArrowUpRight aria-hidden />}>
                <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
                  Source on GitHub<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
              <Button asChild variant="link" trailingIcon={<ArrowUpRight aria-hidden />}>
                <a href={SELF_HOST_URL} target="_blank" rel="noopener noreferrer">
                  Self-hosting guide<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </Button>
            </div>
          }
        />
        <CodeBlock code={selfHostSnippet} language="bash" label="Terminal" />
      </Section>
    </div>
  );
}

function Hero() {
  return (
    <section className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:py-24">
      <div className="flex flex-col gap-8">
        <PageHeader
          size="hero"
          eyebrow="Open-source scripture infrastructure"
          title="Scripture for every screen."
          serifLine="Read it, embed it, build on it."
          description="A public reader, drop-in widgets, and a JSON API, all open source. Reading needs no account and no key."
        />
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/read">Start reading</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/docs/quickstart">Explore the API</Link>
          </Button>
        </div>
        <CatalogCounts />
      </div>
      <VerseOfTheDay />
    </section>
  );
}

/**
 * Live size of the catalog. Shares the translations page's query, so moving on
 * to /docs/translations is instant. Renders nothing until the numbers are real.
 */
function CatalogCounts() {
  const { data } = useQuery({ queryKey: ["translations"], queryFn: () => translations.list() });
  const counts = useMemo(() => {
    if (!data || data.length === 0) return null;
    const languages = new Set(data.map((t) => t.languageCode?.toLowerCase()).filter(Boolean));
    return { versions: data.length, languages: languages.size };
  }, [data]);
  if (!counts) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-hairline pt-5 text-body-sm text-ink-secondary">
      <span>
        <strong className="text-h4 font-semibold tabular-nums text-ink">{numberFormat.format(counts.versions)}</strong> translations
        in <strong className="text-h4 font-semibold tabular-nums text-ink">{numberFormat.format(counts.languages)}</strong> languages.
      </span>
      <Link to="/docs/translations" className="font-semibold text-accent-text underline-offset-4 hover:underline">
        Browse the catalog
      </Link>
    </p>
  );
}

function VerseOfTheDay() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["bible-daily", "WEB"],
    queryFn: () => bible.daily("WEB"),
    staleTime: 60 * 60 * 1000,
  });
  return (
    <Card as="section" aria-labelledby="daily-title" padding="lg" className="flex flex-col gap-5">
      <h2 id="daily-title" className="text-eyebrow font-semibold uppercase text-accent-text">
        Verse of the day
      </h2>
      {isPending ? (
        <div aria-busy="true">
          <SkeletonText lines={4} />
          <span className="sr-only">Loading the verse of the day</span>
        </div>
      ) : isError ? (
        <p className="text-body text-ink-secondary">
          Today's verse is not available right now. The reader is open whenever you are.
        </p>
      ) : (
        <figure className="flex flex-col gap-4">
          <blockquote className="font-serif text-h3 italic leading-snug text-ink">
            <p>{data.text}</p>
          </blockquote>
          <figcaption className="text-body-sm text-ink-secondary">
            <span className="font-semibold text-ink">{data.reference}</span>, {data.version}
          </figcaption>
        </figure>
      )}
      <Button asChild variant="link" className="self-start" trailingIcon={<ArrowRight aria-hidden />}>
        <Link to="/read">Open the reader</Link>
      </Button>
    </Card>
  );
}

function Section({
  index,
  eyebrow,
  spacing,
  flip = false,
  children,
}: {
  index: string;
  eyebrow: string;
  /** Alternate dense and open sections so the page has rhythm (DESIGN.md Layout). */
  spacing: "dense" | "open";
  /** Put the text on the right from lg up, alternating sides between sections. */
  flip?: boolean;
  children: [ReactNode, ReactNode];
}) {
  const [text, aside] = children;
  return (
    <section className={spacing === "open" ? "border-t border-hairline py-16 sm:py-24" : "border-t border-hairline py-12 sm:py-16"}>
      <Eyebrow index={index} className="mb-8">
        {eyebrow}
      </Eyebrow>
      {/* Code and lists get the wider column; the text keeps a readable measure. */}
      <div
        className={
          flip
            ? "grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16"
            : "grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
        }
      >
        <div className={flip ? "lg:order-2" : undefined}>{text}</div>
        <div className="min-w-0">{aside}</div>
      </div>
    </section>
  );
}

function SectionText({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex max-w-measure flex-col gap-4">
      <h2 className="text-h2 font-bold text-balance text-ink">{title}</h2>
      <p className="text-body-lg text-ink-secondary">{body}</p>
      <div className="pt-2">{action}</div>
    </div>
  );
}

/**
 * The one committed panel: the point where a Visitor becomes an Integrator.
 * The global focus colour is indigo, invisible on this fill, so the panel
 * switches it to white for everything inside.
 */
function DecisionPanel() {
  return (
    <Card
      as="section"
      variant="committed"
      padding="lg"
      aria-labelledby="decision-title"
      className="my-8 [--focus:var(--ink-on-accent)] sm:my-12"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-measure flex-col gap-3">
          <h2 id="decision-title" className="text-h1 font-bold text-balance">
            Reading stays open. Get a key when you need more.
          </h2>
          <p className="text-body-lg">
            Secret keys stay on your server. Publishable keys work in the browser, only from the sites you list. Your
            dashboard shows what each one uses.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4">
          <Button asChild size="lg" variant="secondary">
            <Link to="/dashboard/keys">Create a key</Link>
          </Button>
          <Link to="/docs/quickstart" className="text-body font-semibold text-on-accent underline underline-offset-4">
            Read the quick start first
          </Link>
        </div>
      </div>
    </Card>
  );
}
