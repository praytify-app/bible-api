import type { ApiKey, KeyKind, Limits } from "@/lib/api";

export interface KindInfo {
  label: string;
  /** Where the key is safe to use, in one sentence. */
  where: string;
  /** What it can and cannot do. */
  scope: string;
  /** The prefix every key of this kind starts with (ADR 0001). */
  prefix: string;
  badgeTone: "accent" | "neutral";
}

export const KIND_INFO: Record<KeyKind, KindInfo> = {
  secret: {
    label: "Secret",
    where: "For servers. Keep it out of browsers, apps, and repositories.",
    scope: "Full read access, including full-Bible downloads.",
    prefix: "pb_sk_",
    badgeTone: "accent",
  },
  publishable: {
    label: "Publishable",
    where: "Safe in browser code on the sites you allow.",
    scope: "Read-only, limited to your allowed origins, with its own rate limit.",
    prefix: "pb_pk_",
    badgeTone: "neutral",
  },
};

/** Keys created before ADR 0001 have no kind; the gateway treats them as secret. */
export function kindOf(key: Pick<ApiKey, "kind">): KeyKind {
  return key.kind === "publishable" ? "publishable" : "secret";
}

export function formatLimits(limits: Limits | undefined, locale?: string): string | undefined {
  if (!limits) return undefined;
  const n = new Intl.NumberFormat(locale);
  return `${n.format(limits.perMinute)} requests a minute, ${n.format(limits.perDay)} a day`;
}

// --- Expiry ---------------------------------------------------------------------

const DAY_MS = 86_400_000;
/** Inside this many days, an expiry date becomes a warning. */
export const EXPIRY_WARNING_DAYS = 14;

export const EXPIRY_CHOICES = [
  { value: "never", label: "Never" },
  { value: "30", label: "In 30 days" },
  { value: "90", label: "In 90 days" },
  { value: "365", label: "In 365 days" },
] as const;

export type ExpiryChoice = (typeof EXPIRY_CHOICES)[number]["value"];

export function expiresInDays(choice: ExpiryChoice): number | undefined {
  return choice === "never" ? undefined : Number(choice);
}

export type ExpiryState =
  | { state: "never" }
  | { state: "expired" }
  | { state: "soon"; days: number }
  | { state: "active"; days: number };

export function expiryState(expiresAt: string | null | undefined, now = Date.now()): ExpiryState {
  if (!expiresAt) return { state: "never" };
  const remaining = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(remaining)) return { state: "never" };
  if (remaining <= 0) return { state: "expired" };
  const days = Math.ceil(remaining / DAY_MS);
  return days <= EXPIRY_WARNING_DAYS ? { state: "soon", days } : { state: "active", days };
}

export function expiryLabel(expiry: ExpiryState): string {
  switch (expiry.state) {
    case "never":
      return "Never";
    case "expired":
      return "Expired";
    default:
      return expiry.days === 1 ? "Expires in 1 day" : `Expires in ${expiry.days} days`;
  }
}

/** An expired key still counts as listed but no longer works or counts toward the limit. */
export function isExpired(key: Pick<ApiKey, "expiresAt">, now = Date.now()): boolean {
  return expiryState(key.expiresAt, now).state === "expired";
}

// --- Time formatting ----------------------------------------------------------------

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * DAY_MS],
  ["month", 30 * DAY_MS],
  ["week", 7 * DAY_MS],
  ["day", DAY_MS],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 minutes ago", "yesterday", "in 2 weeks". Under a minute reads "just now". */
export function relativeTime(iso: string, now = Date.now(), locale?: string): string {
  const delta = new Date(iso).getTime() - now;
  if (!Number.isFinite(delta)) return "Unknown";
  if (Math.abs(delta) < 60_000) return "just now";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(delta) >= ms) return rtf.format(Math.round(delta / ms), unit);
  }
  return rtf.format(Math.round(delta / 60_000), "minute");
}

export function absoluteTime(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function shortDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

// --- "Use it" snippets -----------------------------------------------------------------

export interface Snippet {
  label: string;
  language: string;
  code: string;
}

const SAMPLE_PATH = "/v1/search?q=love&version=WEB";

/**
 * Ready-to-run examples for a freshly revealed key. Secret keys get server
 * examples; publishable keys get browser code, because that is the only place
 * they work (the gateway checks the request's Origin).
 */
export function usageSnippets(kind: KeyKind, key: string, apiUrl: string, origins: readonly string[] = []): Snippet[] {
  const url = `${apiUrl}${SAMPLE_PATH}`;
  if (kind === "secret") {
    return [
      {
        label: "curl",
        language: "bash",
        code: `curl "${url}" \\\n  -H "Authorization: Bearer ${key}"`,
      },
      {
        label: "Node.js",
        language: "javascript",
        code: [
          "// Server-side only. Load the key from an environment variable in real code.",
          `const res = await fetch("${url}", {`,
          `  headers: { Authorization: "Bearer ${key}" },`,
          "});",
          "const { data } = await res.json();",
        ].join("\n"),
      },
    ];
  }
  const where = origins.length > 0 ? origins.join(", ") : "an allowed origin";
  return [
    {
      label: "Browser",
      language: "javascript",
      code: [
        `// Runs in the browser on ${where}.`,
        "// The gateway checks the page's Origin; any other site gets a 403.",
        `const res = await fetch("${url}", {`,
        `  headers: { Authorization: "Bearer ${key}" },`,
        "});",
        "const { data } = await res.json();",
      ].join("\n"),
    },
  ];
}
