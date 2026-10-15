import { BookOpen, ChartColumn, CodeXml, KeyRound, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

// One source for every navigation surface (public header, mobile sheet, footer,
// dashboard sidebar), organised by what each persona does (BRIEF §5). Every
// item points at a registered route or a real external page.

/**
 * Public source repository, from the VITE_SOURCE_URL build argument. Every
 * source link (header, menu, footer, landing) renders only when it is set, so
 * no build points visitors at a private or missing repository (BRIEF §11).
 */
export const SOURCE_URL: string | undefined =
  import.meta.env.VITE_SOURCE_URL?.trim().replace(/\/+$/, "").replace(/\.git$/, "") || undefined;
export const SELF_HOST_URL = SOURCE_URL ? `${SOURCE_URL}#self-host` : undefined;

/** "GitHub" when the source lives there, otherwise the neutral "Source". */
export const SOURCE_LABEL = (() => {
  try {
    return SOURCE_URL && new URL(SOURCE_URL).hostname === "github.com" ? "GitHub" : "Source";
  } catch {
    return "Source";
  }
})();
export const PRAYTIFY_URL = "https://praytify.app";

export interface NavItem {
  label: string;
  to: "/read" | "/embed" | "/docs" | "/docs/quickstart" | "/docs/translations";
  description?: string;
}

/** Top-level public links, in header order. Docs is a menu of its own. */
export const publicNav: NavItem[] = [
  { label: "Read", to: "/read" },
  { label: "Embed", to: "/embed" },
];

export const docsNav: NavItem[] = [
  { label: "Quick start", to: "/docs/quickstart", description: "Your first request in a few minutes" },
  { label: "API reference", to: "/docs", description: "Every endpoint and its parameters" },
  { label: "Translations", to: "/docs/translations", description: "Browse the catalog by language" },
];

export interface DashboardNavItem {
  label: string;
  to: "/dashboard" | "/dashboard/keys" | "/dashboard/usage" | "/dashboard/embed" | "/dashboard/settings";
  icon: LucideIcon;
  /** Overview owns only its own URL; the others stay active on anything below them. */
  exact?: boolean;
}

export const dashboardNav: DashboardNavItem[] = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "API keys", to: "/dashboard/keys", icon: KeyRound },
  { label: "Usage", to: "/dashboard/usage", icon: ChartColumn },
  { label: "Embed", to: "/dashboard/embed", icon: CodeXml },
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
];

/** Below the main sidebar group: leaves the dashboard for the public docs. */
export const dashboardDocsLink = { label: "Docs", to: "/docs/quickstart", icon: BookOpen } as const;
