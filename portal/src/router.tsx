import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import { DashboardShell } from "./components/shell/DashboardShell";
import { PublicShell } from "./components/shell/PublicShell";
import { ReaderHome } from "./components/shell/ReaderHome";
import { validateLoginSearch } from "./features/auth/redirect";
import { NotFoundPage, RouteErrorPage, RoutePending } from "./components/shell/RouteStates";

// Code-based routes (AUDIT must-not-regress 16). Every URL from before the
// revamp is kept. Only the two shells load up front; each page is its own
// chunk, so recharts reaches the browser only on /dashboard/usage.

const rootRoute = createRootRoute({
  component: Outlet,
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
  component: lazyRouteComponent(() => import("./pages/LandingPage"), "LandingPage"),
});

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/login",
  // `?redirect=` brings a bounced visitor back to the dashboard page they asked for.
  validateSearch: validateLoginSearch,
  component: lazyRouteComponent(() => import("./pages/LoginPage"), "LoginPage"),
});

const docsRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/docs",
  component: lazyRouteComponent(() => import("./pages/DocsPage"), "DocsPage"),
});

const quickstartRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/docs/quickstart",
  component: lazyRouteComponent(() => import("./pages/QuickStartPage"), "QuickStartPage"),
});

const translationsRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/docs/translations",
  component: lazyRouteComponent(() => import("./pages/TranslationsPage"), "TranslationsPage"),
});

const embedRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/embed",
  component: lazyRouteComponent(() => import("./pages/EmbedPage"), "EmbedPage"),
});

// Resumes the last chapter read in this browser (features/reader/last-read).
const readIndexRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/read",
  component: ReaderHome,
});

/** Verse selection in a shared reader link: `?v=16` or `?v=16-18`. */
export interface ReaderSearch {
  v?: string;
}

const VERSE_SELECTION = /^[1-9]\d{0,2}(?:-[1-9]\d{0,2})?$/;

const readChapterRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/read/$version/$book/$chapter",
  // A malformed `v` is dropped rather than failing the page: the chapter still opens.
  validateSearch: (search: Record<string, unknown>): ReaderSearch => {
    const v = typeof search.v === "number" ? String(search.v) : search.v;
    return typeof v === "string" && VERSE_SELECTION.test(v) ? { v } : {};
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
  component: lazyRouteComponent(() => import("./pages/DashboardOverview"), "DashboardOverview"),
});

const dashboardKeysRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/keys",
  component: lazyRouteComponent(() => import("./pages/ApiKeysPage"), "ApiKeysPage"),
});

const dashboardUsageRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/usage",
  component: lazyRouteComponent(() => import("./pages/UsagePage"), "UsagePage"),
});

const dashboardEmbedRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/embed",
  component: lazyRouteComponent(() => import("./pages/EmbedPage"), "EmbedPage"),
});

const dashboardSettingsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: "/settings",
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
}
