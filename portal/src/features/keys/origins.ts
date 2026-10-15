// Client copy of the gateway's allowed-origin rules (normalizeOriginPattern in
// src/lib/api-keys.ts). It exists so people see a mistake next to the row they
// typed it in, before a round trip. The server stays the authority: if the two
// ever disagree, its message is shown. Change both together.

/** Same cap as the gateway (MAX_ORIGINS in src/routes/keys.ts). */
export const MAX_ORIGINS = 20;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ORIGIN = /^(https?):\/\/(\*\.)?([a-z0-9.-]+|\[::1\])(?::(\d{1,5}|\*))?\/?$/i;

export type OriginCheck =
  | { ok: true; pattern: string; warning?: string }
  | { ok: false; error: string };

function defaultPort(scheme: "http" | "https"): string {
  return scheme === "https" ? "443" : "80";
}

export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase());
}

/**
 * Validate and normalise one allowed origin. Accepts exactly what the gateway
 * accepts: `https://example.org`, `https://*.example.org`, `http://localhost:5173`,
 * `http://localhost:*`. A plain `http://` origin on a real host is accepted (the
 * gateway allows it) but comes back with a warning.
 */
export function checkOrigin(input: string): OriginCheck {
  const raw = input.trim();
  if (raw === "") return { ok: false, error: "Enter an origin, or remove this row." };
  if (raw === "*") return { ok: false, error: "A bare * would let any site use the key. Name the site instead." };

  const match = ORIGIN.exec(raw);
  if (!match) {
    return { ok: false, error: "Use scheme and host only, like https://example.org (no path or query)." };
  }
  const scheme = match[1]!.toLowerCase() as "http" | "https";
  const wildcard = Boolean(match[2]);
  const host = match[3]!.toLowerCase();
  const port = match[4] ?? "";

  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) {
    return { ok: false, error: "That host name is not valid." };
  }
  if (wildcard && (isLocalHost(host) || !host.includes("."))) {
    return { ok: false, error: "A subdomain wildcard needs a real domain, like https://*.example.org." };
  }
  if (port === "*" && !isLocalHost(host)) {
    return { ok: false, error: "A port wildcard (:*) only works for localhost." };
  }
  if (port && port !== "*" && (Number(port) < 1 || Number(port) > 65535)) {
    return { ok: false, error: "Ports run from 1 to 65535." };
  }

  const keptPort = port === defaultPort(scheme) ? "" : port;
  const pattern = `${scheme}://${wildcard ? "*." : ""}${host}${keptPort ? `:${keptPort}` : ""}`;
  const warning = insecureOriginWarning(pattern);
  return warning ? { ok: true, pattern, warning } : { ok: true, pattern };
}

/** Plain http on anything but a local host: allowed, but worth saying why it is a risk. */
export function insecureOriginWarning(pattern: string): string | undefined {
  // The IPv6 literal goes first: `[^:/]+` would stop at its first colon.
  const match = /^http:\/\/(?:\*\.)?(\[::1\]|[^:/]+)/i.exec(pattern);
  if (!match || isLocalHost(match[1]!)) return undefined;
  return "Plain http is unencrypted: anyone on the network path can read or change that page, including how it uses this key. Use https outside local development.";
}

export interface OriginRowsResult {
  /** Normalised, de-duplicated patterns, ready to send. Only meaningful when `valid`. */
  patterns: string[];
  /** One entry per input row: an error message or undefined. */
  errors: (string | undefined)[];
  /** One entry per input row: a warning message or undefined. */
  warnings: (string | undefined)[];
  /** A problem with the list as a whole (none, too many). */
  listError?: string;
  valid: boolean;
}

/** Validate the rows of the origins editor together, so duplicates and the cap are caught too. */
export function checkOriginRows(rows: readonly string[]): OriginRowsResult {
  const patterns: string[] = [];
  const errors: (string | undefined)[] = [];
  const warnings: (string | undefined)[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const result = checkOrigin(row);
    if (!result.ok) {
      errors.push(result.error);
      warnings.push(undefined);
      return;
    }
    const first = seen.get(result.pattern);
    if (first !== undefined) {
      errors.push(`Same origin as row ${first + 1}.`);
      warnings.push(undefined);
      return;
    }
    seen.set(result.pattern, index);
    patterns.push(result.pattern);
    errors.push(undefined);
    warnings.push(result.warning);
  });

  let listError: string | undefined;
  if (rows.length === 0) listError = "Publishable keys need at least one allowed origin.";
  else if (rows.length > MAX_ORIGINS) listError = `A key can have at most ${MAX_ORIGINS} origins.`;

  return { patterns, errors, warnings, listError, valid: !listError && errors.every((e) => e === undefined) };
}
