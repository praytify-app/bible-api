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
      "/v1/versions"
    ).then((r) => r.data || []),
};
