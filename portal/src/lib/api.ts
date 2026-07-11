const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3200";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

// --- API Key Management ---

export interface ApiKey {
  id: string;
  name: string;
  key?: string; // Full key only returned on creation
  prefix?: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

export const keys = {
  list: () =>
    fetchAPI<{ keys: ApiKey[] }>("/api/dashboard/keys").then((r) => r.keys),

  create: (name: string) =>
    fetchAPI<{ key: ApiKey }>("/api/dashboard/keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((r) => r.key),

  revoke: (id: string) =>
    fetchAPI<{ revoked: boolean }>(`/api/dashboard/keys/${id}`, {
      method: "DELETE",
    }),
};

// --- Usage ---

export interface DailyUsage {
  date: string;
  requests: number;
  errors: number;
  avgResponseTimeMs: number;
}

export interface UsageSummary {
  totalRequests: number;
  totalErrors: number;
  avgResponseTimeMs: number;
  requestsToday: number;
  activeKeys: number;
}

export const usage = {
  daily: (days = 30) =>
    fetchAPI<{ daily: DailyUsage[]; period: { from: string; to: string } }>(
      `/api/dashboard/usage?days=${days}`
    ),

  summary: () =>
    fetchAPI<{ summary: UsageSummary }>("/api/dashboard/usage/summary").then(
      (r) => r.summary
    ),
};

// --- Profile ---

export interface DeveloperProfile {
  appName?: string | null;
  appUrl?: string | null;
  description?: string | null;
  tier: string;
  updatedAt?: string;
}

export const profile = {
  get: () =>
    fetchAPI<{ profile: DeveloperProfile | null }>(
      "/api/dashboard/profile"
    ).then((r) => r.profile),

  update: (data: Partial<Pick<DeveloperProfile, "appName" | "appUrl" | "description">>) =>
    fetchAPI<{ profile: DeveloperProfile }>("/api/dashboard/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.profile),
};

// --- Translations ---

export interface Translation {
  id: string;
  abbreviation: string;
  name: string;
  language: string;
  languageCode: string;
  textDirection: string;
  licenseUrl?: string;
}

export const translations = {
  list: () =>
    fetchAPI<{ data: Translation[]; meta?: any }>(
      "/v1/versions?limit=2000"
    ).then((r) => r.data || []),
};

// --- Public Bible reading (no API key required) ---

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

export const bible = {
  versions: (search?: string) =>
    fetchAPI<{ data: BibleVersion[] }>(
      `/v1/versions?limit=2000${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ).then((r) => r.data || []),

  version: (idOrAbbr: string) =>
    fetchAPI<{ data: BibleVersion }>(
      `/v1/versions/${encodeURIComponent(idOrAbbr)}`
    ).then((r) => r.data),

  books: (versionIdOrAbbr: string) =>
    fetchAPI<{ data: BibleBook[] }>(
      `/v1/versions/${encodeURIComponent(versionIdOrAbbr)}/books`
    ).then((r) => r.data || []),

  chapterVerses: (version: string, bookCode: string, chapter: string | number) =>
    fetchAPI<{ data: BibleVerse[] }>(
      `/v1/chapters/${encodeURIComponent(version)}/${encodeURIComponent(bookCode)}/${chapter}/verses`
    ).then((r) => r.data || []),
};
