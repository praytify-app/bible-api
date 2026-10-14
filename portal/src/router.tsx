import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import { AppRoot } from "./components/shell/AppRoot";
import { DashboardShell } from "./components/shell/DashboardShell";
import { pageTitle, SITE_NAME } from "./components/shell/document-title";
import { PublicShell } from "./components/shell/PublicShell";
import { ReaderHome } from "./components/shell/ReaderHome";
import { validateLoginSearch } from "./features/auth/redirect";
import { validateUsageSearch } from "./features/usage/search";
import { NotFoundPage, RouteErrorPage, RoutePending } from "./components/shell/RouteStates";

// Code-based routes (AUDIT must-not-regress 16). Every URL from before the
// revamp is kept. Only the two shells load up front; each page is its own
// chunk, so recharts reaches the browser only on /dashboard/usage.

const rootRoute = createRootRoute({
  component: AppRoot,
  // Unknown URLs outside the dashboard get the public frame, so the nav still works.
  notFoundComponent: () => (
    <PublicShell>
      <NotFoundPage />
    </PublicShell>
  ),
});

// Header, footer and the public nav. Pathless: it adds no URL segment, but it
// does prefix route ids ("/_public/read/$version/$book/$chapter").
const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_public",
  component: PublicShell,
});

const indexRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/",
  staticData: { title: `${SITE_NAME}: scripture for every screen` },
  component: lazyRouteComponent(() => import("./pages/LandingPage"), "LandingPage"),
});

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/login",
  staticData: { title: pageTitle("Sign in") },
  // `?redirect=` brings a bounced visitor back to the dashboard page they asked for.
  validateSearch: validateLoginSearch,
  component: lazyRouteComponent(() => import("./pages/LoginPage"), "LoginPage"),
});

const docsRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/docs",
  staticData: { title: pageTitle("API reference") },
  component: lazyRouteComponent(() => import("./pages/DocsPage"), "DocsPage"),
});

const quickstartRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/docs/quickstart",
  staticData: { title: pageTitle("Quick start") },
  component: lazyRouteComponent(() => import("./pages/QuickStartPage"), "QuickStartPage"),
});

const translationsRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/docs/translations",
  staticData: { title: pageTitle("Translations") },
  component: lazyRouteComponent(() => import("./pages/TranslationsPage"), "TranslationsPage"),
});

const embedRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/embed",
  staticData: { title: pageTitle("Embed builder") },
  component: lazyRouteComponent(() => import("./pages/EmbedPage"), "EmbedPage"),
});

// Resumes the last chapter read in this browser (features/reader/last-read).
// No title on either reader route: the reader titles itself by chapter.
const readIndexRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/read",
  component: ReaderHome,
});

/** Verse selection in a shared reader link: `?v=16` or `?v=16-18`. */
export interface ReaderSearch {
  v?: string;
}

const readChapterRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/read/$version/$book/$chapter",
  // The reader parses and validates `v` itself (features/reader), so the route
  // only keeps it a string. Anything else is dropped and the chapter still opens.
  validateSearch: (search: Record<string, unknown>): ReaderSearch => {
    const v = typeof search.v === "number" ? String(search.v) : search.v;
    return typeof v === "string" && v !== "" ? { v } : {};
  },
  component: lazyRouteComponent(() => import("./pages/ReadPage"), "ReadPage"),
});

// Auth guard plus sidebar frame. Pages below render only for a signed-in user.
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardShell,
  notFoundComponent: () => <NotFoundPage home="/dashboard" />,
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/",
  staticData: { title: pageTitle("Dashboard") },
  component: lazyRouteComponent(() => import("./pages/DashboardOverview"), "DashboardOverview"),
});

const dashboardKeysRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/keys",
  staticData: { title: pageTitle("API keys") },
  component: lazyRouteComponent(() => import("./pages/ApiKeysPage"), "ApiKeysPage"),
});

const dashboardUsageRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/usage",
  staticData: { title: pageTitle("Usage") },
  // `?days=7|90` and `?keyId=`, so links from the key manager type-check.
  validateSearch: validateUsageSearch,
  component: lazyRouteComponent(() => import("./pages/UsagePage"), "UsagePage"),
});

const dashboardEmbedRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/embed",
  staticData: { title: pageTitle("Embed builder") },
  component: lazyRouteComponent(() => import("./pages/EmbedPage"), "EmbedPage"),
});

const dashboardSettingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/settings",
  staticData: { title: pageTitle("Settings") },
  component: lazyRouteComponent(() => import("./pages/SettingsPage"), "SettingsPage"),
});

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([
    indexRoute,
    loginRoute,
    docsRoute,
    quickstartRoute,
    translationsRoute,
    embedRoute,
    readIndexRoute,
    readChapterRoute,
  ]),
  dashboardRoute.addChildren([
    dashboardIndexRoute,
    dashboardKeysRoute,
    dashboardUsageRoute,
    dashboardEmbedRoute,
    dashboardSettingsRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  // Load a page's chunk when a link is hovered or focused, not on click.
  defaultPreload: "intent",
  defaultPendingComponent: RoutePending,
  // Errors render inside the nearest shell, so navigation keeps working.
  defaultErrorComponent: RouteErrorPage,
  // Plain query strings. The default JSON-encodes values that look like JSON,
  // which would turn a shared `?v=16` into `?v=%2216%22`. Values come back as
  // strings; validateSearch narrows them.
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith(JSON.stringify),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    /** Full document title. Omit it where the page titles itself (the reader). */
    title?: string;
  }
}
