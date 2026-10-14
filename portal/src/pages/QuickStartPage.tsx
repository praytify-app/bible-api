import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, CodeXml, DatabaseZap, Gauge, KeyRound, Package, ShieldCheck, TriangleAlert } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CodeBlock,
  Eyebrow,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ds";
import { HOSTED_API_URL, PUBLISHED_LIMITS } from "@/features/docs/published-limits";
import { RateLimitTable } from "@/features/docs/RateLimitTable";
import { SectionNav, type SectionLink } from "@/features/docs/SectionNav";
import { API_URL } from "@/lib/api";
import { useSession } from "@/lib/auth";

const sections = [
  { id: "no-key", title: "Read without a key", description: "Public routes", icon: <BookOpen /> },
  { id: "keys", title: "When you need a key", description: "Search and downloads", icon: <KeyRound /> },
  { id: "key-kinds", title: "Secret or publishable", description: "Server or browser", icon: <ShieldCheck /> },
  { id: "sdk", title: "Use the SDK", description: "TypeScript client", icon: <Package /> },
  { id: "embed", title: "Embed a verse", description: "One script tag", icon: <CodeXml /> },
  { id: "rate-limits", title: "Rate limits", description: "Per IP and per account", icon: <Gauge /> },
  { id: "errors", title: "Errors and retries", description: "One envelope", icon: <TriangleAlert /> },
  { id: "caching", title: "Caching", description: "ETag and 304", icon: <DatabaseZap /> },
] satisfies SectionLink[];

const publicRoutes = [
  { what: "Translations", path: "/v1/versions?language=eng" },
  { what: "Books in a translation", path: "/v1/versions/WEB/books" },
  { what: "A chapter", path: "/v1/chapters/WEB/JHN/3/verses" },
  { what: "A reference or range", path: "/v1/verses?ref=Psalm 23:1-4&version=WEB" },
  { what: "Several translations side by side", path: "/v1/verses?ref=John 3:16&version=WEB,KJV" },
  { what: "Verse of the day", path: "/v1/daily?version=WEB" },
  { what: "Languages", path: "/v1/languages" },
];

const count = new Intl.NumberFormat();

function Section({ index, id, title, children }: { index: number; id: string; title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="lg" id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Eyebrow index={String(index).padStart(2, "0")}>{sections[index - 1].description}</Eyebrow>
          <h2 id={`${id}-title`} className="text-h2 font-semibold text-ink">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </Card>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-measure flex-col gap-3 text-body text-ink-secondary [&_code]:rounded-sm [&_code]:bg-surface-sunken [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-body-sm [&_code]:text-ink [&_strong]:text-ink">
      {children}
    </div>
  );
}

const inlineLink = "font-semibold text-accent-text underline-offset-4 hover:underline";

export function QuickStartPage() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const selfHosted = API_URL !== HOSTED_API_URL;
  const portalOrigin = window.location.origin;
  const sdkBase = selfHosted ? `{ baseUrl: "${API_URL}" }` : "";
  const sdkBaseKey = selfHosted ? `, baseUrl: "${API_URL}"` : "";
  const embedApi = selfHosted ? ` api="${API_URL}"` : "";

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Docs"
        title="Quick start"
        serifLine="from first call to production"
        description="Reading scripture needs no account. Add a key when you need search, downloads, or a quota of your own."
      />

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <SectionNav label="On this page" sections={sections} />

        <div className="flex min-w-0 flex-col gap-6">
          <Section index={1} id="no-key" title="Read without a key">
            <Prose>
              <p>
                Every read route is public. Call it from a browser, a server, or the command line with no
                Authorization header. Anonymous requests share a limit of{" "}
                <strong>
                  {count.format(PUBLISHED_LIMITS.anonymous.perMinute)} a minute and{" "}
                  {count.format(PUBLISHED_LIMITS.anonymous.perDay)} a day per IP address
                </strong>
                .
              </p>
            </Prose>
            <CodeBlock
              tabs={[
                { label: "cURL", language: "bash", code: `curl "${API_URL}/v1/verses?ref=John%203:16&version=WEB"` },
                {
                  label: "JavaScript",
                  language: "javascript",
                  code: `const res = await fetch("${API_URL}/v1/verses?ref=John%203:16&version=WEB");
const { data } = await res.json();
console.log(data.reference, data.verses[0].text);`,
                },
                {
                  label: "Python",
                  language: "python",
                  code: `import requests

res = requests.get("${API_URL}/v1/verses", params={"ref": "John 3:16", "version": "WEB"})
data = res.json()["data"]
print(data["reference"], data["verses"][0]["text"])`,
                },
              ]}
            />
            <Table caption="Public routes" stackOnMobile>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>What</TableHeaderCell>
                  <TableHeaderCell>Example</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publicRoutes.map((route) => (
                  <TableRow key={route.path}>
                    <TableCell>{route.what}</TableCell>
                    <TableCell label="Example">
                      <code className="break-all font-mono text-caption text-ink">GET {route.path}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-body-sm text-ink-secondary">
              Browse every translation and its abbreviation in the{" "}
              <Link to="/docs/translations" className={inlineLink}>
                translations catalog
              </Link>
              .
            </p>
          </Section>

          <Section index={2} id="keys" title="When you need a key">
            <Prose>
              <p>
                Two routes need a key, and a key also moves you from the shared per-IP limit onto your own account
                quota. Send it as <code>Authorization: Bearer &lt;key&gt;</code>.
              </p>
            </Prose>
            <Table caption="Routes that need a key" stackOnMobile>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>What</TableHeaderCell>
                  <TableHeaderCell>Example</TableHeaderCell>
                  <TableHeaderCell>Key kinds</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Full-text search</TableCell>
                  <TableCell label="Example">
                    <code className="break-all font-mono text-caption text-ink">GET /v1/search?q=still waters&version=WEB</code>
                  </TableCell>
                  <TableCell label="Key kinds">Secret or publishable</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Full-Bible download</TableCell>
                  <TableCell label="Example">
                    <code className="break-all font-mono text-caption text-ink">GET /v1/versions/WEB/download</code>
                  </TableCell>
                  <TableCell label="Key kinds">Secret only</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to="/dashboard/keys">{signedIn ? "Create a key" : "Sign in to create a key"}</Link>
              </Button>
              {!signedIn && <span className="text-body-sm text-ink-muted">Free, with email or a provider account.</span>}
            </div>
          </Section>

          <Section index={3} id="key-kinds" title="Secret or publishable">
            <Prose>
              <p>
                <strong>Secret keys</strong> (<code>pb_sk_…</code>) are for servers. Keep them in an environment
                variable and never ship one to a browser or a mobile app.
              </p>
              <p>
                <strong>Publishable keys</strong> (<code>pb_pk_…</code>) are safe in browser code. They only work from
                the origins you list on the key, can only read, and cannot download whole Bibles.
              </p>
            </Prose>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="danger">Server only</Badge>
                <h3 className="text-h4 font-semibold text-ink">Secret key on a server</h3>
              </div>
              <CodeBlock
                tabs={[
                  {
                    label: "Node",
                    language: "javascript",
                    code: `// The key lives in your server's environment, never in client code.
const res = await fetch("${API_URL}/v1/search?q=still%20waters&version=WEB", {
  headers: { Authorization: \`Bearer \${process.env.PRAYTIFY_BIBLE_KEY}\` }, // pb_sk_…
});
const { data } = await res.json();`,
                  },
                  {
                    label: "cURL",
                    language: "bash",
                    code: `curl -H "Authorization: Bearer $PRAYTIFY_BIBLE_KEY" \\
  "${API_URL}/v1/search?q=still%20waters&version=WEB"`,
                  },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="success">Browser safe</Badge>
                <h3 className="text-h4 font-semibold text-ink">Publishable key in a web page</h3>
              </div>
              <CodeBlock
                label="Browser HTML"
                language="html"
                code={`<script type="module">
  // A publishable key only works from the origins you list on it.
  const res = await fetch("${API_URL}/v1/search?q=still%20waters&version=WEB", {
    headers: { Authorization: "Bearer pb_pk_your_publishable_key" },
  });
  const { data } = await res.json();
</script>`}
              />
            </div>
          </Section>

          <Section index={4} id="sdk" title="Use the SDK">
            <Prose>
              <p>
                <code>@praytify/bible</code> is a typed, zero-dependency client for browsers, Node, Bun, Deno, and React
                Native. It retries on <code>429</code> and <code>5xx</code> honouring <code>Retry-After</code>, times
                out stuck requests, and caches scripture reads in memory.
              </p>
            </Prose>
            <CodeBlock label="Install" language="bash" code="npm install @praytify/bible" />
            <CodeBlock
              label="TypeScript"
              language="ts"
              code={`import { createClient } from "@praytify/bible";

// Reading needs no key.
const bible = createClient(${sdkBase});
const passage = await bible.passage("John 3:16-18", { version: "WEB" });
const psalm = await bible.chapter("WEB", "PSA", 23);

// Search needs a key: secret on servers, publishable in browsers.
const server = createClient({ apiKey: process.env.PRAYTIFY_BIBLE_KEY${sdkBaseKey} });
const hits = await server.search("still waters", { version: "WEB" });`}
            />
          </Section>

          <Section index={5} id="embed" title="Embed a verse">
            <Prose>
              <p>
                No key, no build step, no framework. The widget renders in a shadow root, follows the visitor's light
                or dark preference, links to the full chapter, and shows the translation's attribution.
              </p>
            </Prose>
            <CodeBlock
              label="Embed HTML"
              language="html"
              code={`<script type="module" src="${portalOrigin}/embed/v1.js"></script>

<praytify-verse reference="Romans 8:28" version="WEB"${embedApi}></praytify-verse>
<praytify-daily version="WEB"${embedApi}></praytify-daily>`}
            />
            <div>
              <Button asChild variant="secondary">
                <Link to="/embed">Build a snippet with the embed builder</Link>
              </Button>
            </div>
          </Section>

          <Section index={6} id="rate-limits" title="Rate limits">
            <Prose>
              <p>
                Account quotas are per key kind and shared across all of an account's keys, so a busy embed cannot
                starve your server. Every response carries <code>X-RateLimit-Limit</code>,{" "}
                <code>X-RateLimit-Remaining</code>, and <code>X-RateLimit-Reset</code>.
              </p>
            </Prose>
            <RateLimitTable />
          </Section>

          <Section index={7} id="errors" title="Errors and retries">
            <Prose>
              <p>
                Every error has the same shape, whether it came from the gateway or the engine behind it. Branch on{" "}
                <code>code</code>, show <code>message</code>. A <code>429</code> carries <code>Retry-After</code> in
                seconds: wait that long before trying again.
              </p>
            </Prose>
            <CodeBlock
              label="401 response"
              language="json"
              code={`{
  "error": {
    "code": "API_KEY_REQUIRED",
    "message": "This endpoint needs an API key. Send 'Authorization: Bearer <key>'. Create one at https://praytify.bible/dashboard/keys."
  }
}`}
            />
            <CodeBlock
              label="Retry in JavaScript"
              language="javascript"
              code={`async function getJson(url, init) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, init);
    if (res.status === 429) {
      const seconds = Number(res.headers.get("Retry-After")) || 1;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(\`\${body.error.code}: \${body.error.message}\`);
    return body;
  }
  throw new Error("Still rate limited after 3 attempts");
}`}
            />
          </Section>

          <Section index={8} id="caching" title="Caching">
            <Prose>
              <p>
                Scripture responses carry <code>ETag</code> and <code>Cache-Control</code>. Send the ETag back in{" "}
                <code>If-None-Match</code> and an unchanged response comes back as <code>304 Not Modified</code> with
                no body.
              </p>
            </Prose>
            <CodeBlock
              label="Conditional request"
              language="bash"
              code={`curl -i "${API_URL}/v1/chapters/WEB/PSA/23/verses"
# HTTP/1.1 200 OK
# ETag: "…"

curl -i -H 'If-None-Match: "…"' "${API_URL}/v1/chapters/WEB/PSA/23/verses"
# HTTP/1.1 304 Not Modified`}
            />
          </Section>

          <Alert tone="info" role="none" title="Where next">
            Every endpoint and parameter is in the{" "}
            <Link to="/docs" className={inlineLink}>
              API reference
            </Link>
            . Once you have a key, the{" "}
            <Link to="/dashboard/usage" className={inlineLink}>
              usage dashboard
            </Link>{" "}
            shows each day's requests and errors.
          </Alert>
        </div>
      </div>
    </div>
  );
}
