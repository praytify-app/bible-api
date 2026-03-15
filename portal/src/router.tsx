import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import { RootLayout } from "./components/RootLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardOverview } from "./pages/DashboardOverview";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { UsagePage } from "./pages/UsagePage";
import { SettingsPage } from "./pages/SettingsPage";
import { DocsPage } from "./pages/DocsPage";
import { QuickStartPage } from "./pages/QuickStartPage";
import { TranslationsPage } from "./pages/TranslationsPage";

// Root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

// Public routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

// Docs routes
const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs",
  component: DocsPage,
});

const quickstartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/quickstart",
  component: QuickStartPage,
});

const translationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/docs/translations",
  component: TranslationsPage,
});

// Dashboard layout route
const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: DashboardLayout,
});

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/",
  component: DashboardOverview,
});

const dashboardKeysRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/keys",
  component: ApiKeysPage,
});

const dashboardUsageRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/usage",
  component: UsagePage,
});

const dashboardSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  docsRoute,
  quickstartRoute,
  translationsRoute,
  dashboardLayoutRoute.addChildren([
    dashboardIndexRoute,
    dashboardKeysRoute,
    dashboardUsageRoute,
    dashboardSettingsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

// Type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
