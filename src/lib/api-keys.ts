import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type KeyKind = "secret" | "publishable";

const KIND_PREFIX: Record<KeyKind, string> = { secret: "pb_sk_", publishable: "pb_pk_" };

/** 32 random bytes: 256 bits, so hashing with plain SHA-256 is sufficient (no stretching needed). */
export function generateApiKey(kind: KeyKind): string {
  return KIND_PREFIX[kind] + randomBytes(32).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Enough of the key to recognise it in a list, never enough to use it. */
export function displayPrefix(key: string): string {
  return key.slice(0, 12) + "…";
}

/** Constant-time string comparison that does not leak length through early exit. */
export function safeEqual(a: string, b: string): boolean {
  const ab = createHash("sha256").update(a).digest();
  const bb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ab, bb) && a.length === b.length;
}

/** "Bearer <key>" with a single space and a non-empty token; anything else is rejected. */
export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  // Visible ASCII only: keys never contain spaces or control characters, and
  // the cap stops a megabyte header from being hashed on every request.
  const m = /^Bearer ([\x21-\x7E]{8,512})$/.exec(header);
  return m ? m[1]! : null;
}

// --- Origin allowlists for publishable keys --------------------------------

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

interface ParsedPattern {
  scheme: "http:" | "https:";
  host: string; // lowercase; may start with "*." for a subdomain wildcard
  port: string; // "" for the scheme default, "*" for any (local hosts only)
}

function defaultPort(scheme: string): string {
  return scheme === "https:" ? "443" : "80";
}

/**
 * Normalise an allowed-origin pattern, or return an error message.
 * Accepted: `https://example.org`, `https://*.example.org`, `http://localhost:5173`,
 * `http://localhost:*`. Rejected: bare `*`, paths, credentials, wildcards anywhere else.
 */
export function normalizeOriginPattern(input: string): { pattern: string } | { error: string } {
  const raw = input.trim();
  if (raw === "*" || raw === "") return { error: "A specific origin is required; '*' is not allowed." };
  const m = /^(https?):\/\/(\*\.)?([a-z0-9.-]+|\[::1\])(?::(\d{1,5}|\*))?\/?$/i.exec(raw);
  if (!m) return { error: `'${raw}' is not an origin like https://example.org` };
  const scheme = `${m[1]!.toLowerCase()}:` as "http:" | "https:";
  const wildcard = Boolean(m[2]);
  const host = m[3]!.toLowerCase();
  const port = m[4] ?? "";
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return { error: `'${raw}' has an invalid host` };
  if (wildcard && (LOCAL_HOSTS.has(host) || !host.includes("."))) {
    return { error: "Subdomain wildcards need a registrable domain, e.g. https://*.example.org" };
  }
  if (port === "*" && !LOCAL_HOSTS.has(host)) return { error: "A port wildcard is only allowed for localhost" };
  if (port && port !== "*" && (Number(port) < 1 || Number(port) > 65535)) return { error: `'${raw}' has an invalid port` };
  const normalizedPort = port === defaultPort(scheme) ? "" : port;
  return { pattern: `${scheme}//${wildcard ? "*." : ""}${host}${normalizedPort ? `:${normalizedPort}` : ""}` };
}

function parsePattern(pattern: string): ParsedPattern | null {
  const m = /^(https?:)\/\/((?:\*\.)?[a-z0-9.-]+|\[::1\])(?::(\d+|\*))?$/.exec(pattern);
  if (!m) return null;
  return { scheme: m[1] as "http:" | "https:", host: m[2]!, port: m[3] ?? "" };
}

/** Does the request's origin match any allowed pattern? */
export function originAllowed(origin: string | null, patterns: readonly string[]): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const scheme = url.protocol;
  const host = url.hostname.toLowerCase();
  const port = url.port || defaultPort(scheme);
  return patterns.some((p) => {
    const pat = parsePattern(p);
    if (!pat || pat.scheme !== scheme) return false;
    const patPort = pat.port || defaultPort(pat.scheme);
    if (patPort !== "*" && patPort !== port) return false;
    if (pat.host.startsWith("*.")) {
      const suffix = pat.host.slice(1); // ".example.org"
      return host.endsWith(suffix) && host.length > suffix.length;
    }
    return host === pat.host;
  });
}

/** The browser origin of a request: Origin when present, else the origin of Referer. */
export function requestOrigin(headers: { origin?: string | null; referer?: string | null }): string | null {
  if (headers.origin && headers.origin !== "null") return headers.origin;
  if (headers.referer) {
    try {
      return new URL(headers.referer).origin;
    } catch {
      return null;
    }
  }
  return null;
}
