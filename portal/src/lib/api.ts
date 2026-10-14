const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3200";

export { API_URL };

/** An error from the gateway or engine, with the machine-readable code when there is one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(message: string, status: number, code: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/**
 * Both envelopes the platform has used: `{ error: { code, message } }` (current)
 * and `{ error: "Unauthorized", message }` (gateways before October 2026).
 */
async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } | string; message?: string }
    | null;
  let code = `HTTP_${res.status}`;
  let message = res.statusText || `Request failed (${res.status})`;
  if (body && typeof body.error === "object" && body.error) {
    code = body.error.code ?? code;
    message = body.error.message ?? message;
  } else if (body) {
    if (typeof body.error === "string") code = body.error.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    if (typeof body.message === "string") message = body.message;
  }
  const ra = Number(res.headers.get("retry-after"));
  return new ApiError(message, res.status, code, Number.isFinite(ra) && ra > 0 ? ra : undefined);
}

/**
 * Credentialed request for /api/dashboard/*. The gateway answers these with
 * an origin-pinned, credentialed CORS policy.
 */
async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/**
 * Anonymous GET for the public read/catalog endpoints. Must NOT send
 * credentials: the gateway serves these with a wildcard
 * Access-Control-Allow-Origin, and browsers reject credentialed requests
 * against a wildcard. No Content-Type header either: a bare GET skips the
 * CORS preflight entirely. (Regression fixed in c167e10; keep it that way.)
 */
async function fetchPublic<T>(path: string, init?: { signal?: AbortSignal; apiKey?: string }): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    signal: init?.signal,
    // Only a publishable key, and only for the optional reader search.
    headers: init?.apiKey ? { Authorization: `Bearer ${init.apiKey}` } : undefined,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

// --- API reference -------------------------------------------------------------

export const apiReference = {
  /** The spec the /docs page renders; a failure means the reference would be blank. */
  spec: (signal?: AbortSignal) => fetchPublic<{ openapi?: string }>("/v1/openapi.json", { signal }),
};

// --- Sign-in methods ---------------------------------------------------------

export interface AuthMethods {
  github: boolean;
  google: boolean;
  emailPassword: boolean;
}

export const authMethods = {
  get: () => fetchPublic<AuthMethods>("/api/auth-methods"),
};

// --- API keys ------------------------------------------------------------------

export type KeyKind = "secret" | "publishable";
export type Tier = "free" | "partner" | "internal";

export interface ApiKey {
  id: string;
  name: string;
  /** Full key: only present in the response that created or rolled it. */
  key?: string;
  prefix?: string;
  kind?: KeyKind;
  allowedOrigins?: string[];
  tier?: Tier;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
}

export interface CreateKeyInput {
  name?: string;
  kind?: KeyKind;
  allowedOrigins?: string[];
  expiresInDays?: number;
}

export const keys = {
  list: () => fetchAPI<{ keys: ApiKey[] }>("/api/dashboard/keys").then((r) => r.keys),

  /** Accepts a bare name for backward compatibility with older callers. */
  create: (input: string | CreateKeyInput) =>
    fetchAPI<{ key: ApiKey }>("/api/dashboard/keys", {
      method: "POST",
      body: JSON.stringify(typeof input === "string" ? { name: input } : input),
    }).then((r) => r.key),

  update: (id: string, patch: { name?: string; allowedOrigins?: string[] }) =>
    fetchAPI<{ key: ApiKey }>(`/api/dashboard/keys/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => r.key),

  /** Issue a replacement with the same settings; the old key stops working at once. */
  roll: (id: string) =>
    fetchAPI<{ key: ApiKey; revokedId: string }>(`/api/dashboard/keys/${encodeURIComponent(id)}/roll`, {
      method: "POST",
    }),

  revoke: (id: string) =>
    fetchAPI<{ revoked: boolean; id: string }>(`/api/dashboard/keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

// --- Usage ---------------------------------------------------------------------

export interface DailyUsage {
  /** UTC date, YYYY-MM-DD. Days without traffic are omitted; zero-fill in the UI. */
  date: string;
  requests: number;
  errors: number;
  avgResponseTimeMs: number;
}

export interface UsageSummary {
  periodDays?: number;
  totalRequests: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  requestsToday: number;
  activeKeys: number;
}

export interface KeyUsage {
  keyId: string;
  name: string;
  kind: KeyKind;
  revoked: boolean;
  requests: number;
  errors: number;
}

export const usage = {
  daily: (days = 30, keyId?: string) =>
    fetchAPI<{ daily: DailyUsage[]; period: { days: number; from: string; to: string } }>(
      `/api/dashboard/usage?days=${days}${keyId ? `&keyId=${encodeURIComponent(keyId)}` : ""}`
    ),

  summary: (days = 30) =>
    fetchAPI<{ summary: UsageSummary }>(`/api/dashboard/usage/summary?days=${days}`).then((r) => r.summary),

  byKey: (days = 30) =>
    fetchAPI<{ keys: KeyUsage[]; period: { days: number; from: string; to: string } }>(
      `/api/dashboard/usage/keys?days=${days}`
    ).then((r) => r.keys),
};

// --- Plan ------------------------------------------------------------------------

export interface Limits {
  perMinute: number;
  perDay: number;
}

export interface Plan {
  tier: Tier;
  limits: { secret: Limits; publishable: Limits; anonymous: Limits };
  maxKeys: number;
  tiers: Record<Tier, { secret: Limits; publishable: Limits }>;
}

export const plan = {
  get: () => fetchAPI<Plan>("/api/dashboard/plan"),
};

export interface PublicLimits {
  anonymous: Limits;
  tiers: Record<Tier, { secret: Limits; publishable: Limits }>;
  maxKeysPerUser: number;
}

/** The limits this deployment enforces, for public pages. No credentials. */
export const limits = {
  get: () => fetchPublic<PublicLimits>("/api/limits"),
};

// --- Profile -------------------------------------------------------------------

export interface DeveloperProfile {
  appName?: string | null;
  appUrl?: string | null;
  description?: string | null;
  tier: string;
  updatedAt?: string | null;
}

export const profile = {
  get: () => fetchAPI<{ profile: DeveloperProfile | null }>("/api/dashboard/profile").then((r) => r.profile),

  /** Partial update: only the fields you send change. */
  update: (data: Partial<Pick<DeveloperProfile, "appName" | "appUrl" | "description">>) =>
    fetchAPI<{ profile: DeveloperProfile }>("/api/dashboard/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.profile),
};

// --- Translations catalog ----------------------------------------------------------

export interface Translation {
  id: string;
  abbreviation: string;
  name: string;
  language: string;
  languageCode: string;
  textDirection: string;
  licenseUrl?: string;
  license?: string | null;
  attribution?: string | null;
  attributionUrl?: string | null;
  verseCount?: number;
}

export interface CatalogMeta {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
}

export const translations = {
  list: () => fetchPublic<{ data: Translation[]; meta?: CatalogMeta }>("/v1/versions?limit=2000").then((r) => r.data || []),
};

// --- Public Bible reading (no API key required) --------------------------------------

export interface BibleVersion {
  id: string;
  abbreviation: string;
  name: string;
  language?: string | null;
  languageCode?: string | null;
  textDirection?: string | null;
  verseCount: number;
  license?: string | null;
  attribution?: string | null;
  attributionUrl?: string | null;
}

export interface BibleBook {
  id: string;
  bookCode: string;
  name: string;
  position: number;
  chapterCount: number;
  testament: string;
}

export interface BibleVerse {
  id: number;
  number: number;
  text: string;
}

export interface Passage {
  reference: string;
  version: string;
  verses: BibleVerse[];
  bookCode?: string;
  bookName?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  attribution?: string | null;
  attributionUrl?: string | null;
  license?: string | null;
}

export interface DailyVerse {
  dayOfYear: number;
  reference: string;
  text: string;
  version: string;
  requestedVersion?: string;
  note?: string;
}

export interface SearchHit {
  id: number;
  verseNumber: number;
  chapterNumber: number;
  bookCode: string;
  bookName: string;
  text: string;
  versionAbbreviation: string;
  attribution?: string | null;
}

/** Normalises engines that still return snake_case search rows. */
function toSearchHit(row: Record<string, unknown>): SearchHit {
  const pick = <T,>(camel: string, snake: string) => (row[camel] ?? row[snake]) as T;
  return {
    id: row.id as number,
    verseNumber: pick("verseNumber", "verse_number"),
    chapterNumber: pick("chapterNumber", "chapter_number"),
    bookCode: pick("bookCode", "book_code"),
    bookName: pick("bookName", "book_name"),
    text: row.text as string,
    versionAbbreviation: pick("versionAbbreviation", "version_abbreviation"),
    attribution: (row.attribution as string | null | undefined) ?? null,
  };
}

/** Publishable key for the reader's optional search box, restricted to the portal's origin. */
export const PUBLIC_SEARCH_KEY: string | undefined = import.meta.env.VITE_PUBLIC_SEARCH_KEY || undefined;

export const bible = {
  versions: (search?: string) =>
    fetchPublic<{ data: BibleVersion[] }>(
      `/v1/versions?limit=2000${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ).then((r) => r.data || []),

  version: (idOrAbbr: string) =>
    fetchPublic<{ data: BibleVersion }>(`/v1/versions/${encodeURIComponent(idOrAbbr)}`).then((r) => r.data),

  books: (versionIdOrAbbr: string) =>
    fetchPublic<{ data: BibleBook[] }>(`/v1/versions/${encodeURIComponent(versionIdOrAbbr)}/books`).then(
      (r) => r.data || []
    ),

  chapterVerses: (version: string, bookCode: string, chapter: string | number) =>
    fetchPublic<{ data: BibleVerse[] }>(
      `/v1/chapters/${encodeURIComponent(version)}/${encodeURIComponent(bookCode)}/${chapter}/verses`
    ).then((r) => r.data || []),

  passage: (reference: string, version: string) =>
    fetchPublic<{ data: Passage }>(
      `/v1/verses?ref=${encodeURIComponent(reference)}&version=${encodeURIComponent(version)}`
    ).then((r) => r.data),

  daily: (version?: string) =>
    fetchPublic<{ data: DailyVerse }>(`/v1/daily${version ? `?version=${encodeURIComponent(version)}` : ""}`).then(
      (r) => r.data
    ),

  /** Only available when VITE_PUBLIC_SEARCH_KEY is configured; callers must check PUBLIC_SEARCH_KEY first. */
  search: (q: string, version: string, signal?: AbortSignal) =>
    fetchPublic<{ data: Record<string, unknown>[] }>(
      `/v1/search?q=${encodeURIComponent(q)}&version=${encodeURIComponent(version)}&limit=25`,
      { signal, apiKey: PUBLIC_SEARCH_KEY }
    ).then((r) => (r.data || []).map(toSearchHit)),

  /**
   * Catalog size without downloading the catalog: the version total comes
   * from pagination metadata, languages from the languages list (only those
   * with at least one version).
   */
  catalogStats: async () => {
    const [versions, languages] = await Promise.all([
      fetchPublic<{ meta?: CatalogMeta }>("/v1/versions?limit=1"),
      fetchPublic<{ data: { versionCount: number }[] }>("/v1/languages"),
    ]);
    return {
      versions: versions.meta?.total ?? null,
      languages: (languages.data || []).filter((l) => l.versionCount > 0).length,
    };
  },

  languages: () =>
    fetchPublic<{ data: { code: string; name: string; versionCount: number }[] }>("/v1/languages").then(
      (r) => r.data || []
    ),
};
