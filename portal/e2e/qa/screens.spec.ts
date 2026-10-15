import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import { API_URL, expect, signUp, test, useTheme, type Theme } from "../support/fixtures";

// Review captures for docs/ui-revamp/screens/: every route at 1440x900
// (desktop project) and 390x844 (mobile project), light and dark, named
// `<route-slug>-<width>-<theme>.png`, plus the states a reviewer needs to see.
// Opt in with QA_SCREENS=1 so a normal run never rewrites the docs.

test.skip(!process.env.QA_SCREENS, "set QA_SCREENS=1 to recapture docs/ui-revamp/screens");
test.use({ reducedMotion: "reduce" });

const SEARCH_KEY = process.env.VITE_PUBLIC_SEARCH_KEY?.trim();

const settled = (page: Page) => expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });

async function capture(page: Page, testInfo: TestInfo, slug: string, theme: Theme, fullPage = true) {
  await settled(page);
  await page.evaluate(() => document.fonts.ready);
  const width = testInfo.project.name === "mobile" ? 390 : 1440;
  const dir = path.resolve(testInfo.project.testDir, "../../docs/ui-revamp/screens");
  await page.screenshot({ path: path.join(dir, `${slug}-${width}-${theme}.png`), fullPage, animations: "disabled" });
}

const verse1 = (page: Page) => expect(page.locator('[data-verse="1"]')).toBeVisible();

// `viewportOnly`: a full-page capture resizes the viewport, which stretches the
// Scalar frame on /docs before it repaints and drags the sticky header and the
// selection toolbar to mid-page on a scrolled selection.
const publicRoutes: { slug: string; path: string; ready: (page: Page) => Promise<void>; viewportOnly?: boolean }[] = [
  { slug: "home", path: "/", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { slug: "login", path: "/login", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  {
    slug: "docs",
    path: "/docs",
    viewportOnly: true,
    ready: (p) =>
      expect(
        p.frameLocator('iframe[title="Praytify Bible API reference"]').getByRole("heading", { name: /Praytify Bible API/ }).first(),
      ).toBeVisible(),
  },
  { slug: "quickstart", path: "/docs/quickstart", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  {
    slug: "translations",
    path: "/docs/translations",
    ready: (p) => expect(p.getByRole("table", { name: "Bible translations" })).toBeVisible(),
  },
  { slug: "embed", path: "/embed", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { slug: "read", path: "/read/WEB/JHN/3", ready: verse1 },
  { slug: "read-rtl", path: "/read/AVD/JHN/3", ready: verse1 },
  { slug: "read-selection", path: "/read/WEB/JHN/3?v=16-18", ready: verse1, viewportOnly: true },
  {
    slug: "not-found",
    path: "/no-such-page",
    ready: (p) => expect(p.getByRole("heading", { name: "We could not find that page." })).toBeVisible(),
  },
];

const dashboardRoutes: { slug: string; path: string; withKey: boolean }[] = [
  { slug: "dashboard-first-run", path: "/dashboard", withKey: false },
  { slug: "dashboard", path: "/dashboard", withKey: true },
  { slug: "keys", path: "/dashboard/keys", withKey: true },
  { slug: "usage", path: "/dashboard/usage", withKey: true },
  { slug: "dashboard-embed", path: "/dashboard/embed", withKey: true },
  { slug: "settings", path: "/dashboard/settings", withKey: true },
];

async function createKey(page: Page, baseURL: string, name: string) {
  const res = await page.request.post(`${API_URL}/api/dashboard/keys`, {
    data: { name },
    headers: { origin: new URL(baseURL).origin },
  });
  expect(res.ok()).toBeTruthy();
}

for (const theme of ["light", "dark"] as Theme[]) {
  for (const route of publicRoutes) {
    test(`${route.slug} (${theme})`, async ({ page }, testInfo) => {
      await useTheme(page, theme);
      await page.goto(route.path);
      await route.ready(page);
      await capture(page, testInfo, route.slug, theme, !route.viewportOnly);
    });
  }

  for (const route of dashboardRoutes) {
    test(`${route.slug} (${theme})`, async ({ page, baseURL }, testInfo) => {
      await useTheme(page, theme);
      await signUp(page, baseURL!);
      if (route.withKey) await createKey(page, baseURL!, "Production web app");
      await page.goto(route.path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await capture(page, testInfo, route.slug, theme);
    });
  }

  test(`menus open on phones (${theme})`, async ({ page, baseURL, isMobile }, testInfo) => {
    test.skip(!isMobile, "the menu sheets exist below the desktop breakpoint");
    await useTheme(page, theme);
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
    await capture(page, testInfo, "menu-open", theme, false);

    await signUp(page, baseURL!);
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open dashboard menu" }).click();
    await expect(page.getByRole("dialog", { name: "Dashboard menu" })).toBeVisible();
    await capture(page, testInfo, "dashboard-menu-open", theme, false);
  });

  test(`key create dialog and one-time reveal (${theme})`, async ({ page, baseURL }, testInfo) => {
    await useTheme(page, theme);
    await signUp(page, baseURL!);
    await page.goto("/dashboard/keys");
    await page.getByRole("button", { name: /^Create (key|your first key)$/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Create an API key" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Production web app");
    await capture(page, testInfo, "keys-create", theme, false);
    await dialog.getByRole("button", { name: "Create key" }).click();
    await expect(page.getByRole("region", { name: "Your new key is ready" })).toBeVisible();
    await capture(page, testInfo, "keys-reveal", theme);
  });

  test(`reader search results (${theme})`, async ({ page }, testInfo) => {
    test.skip(!SEARCH_KEY, "reader search renders only with VITE_PUBLIC_SEARCH_KEY");
    await useTheme(page, theme);
    await page.goto("/read/WEB/JHN/3");
    await verse1(page);
    await page.getByRole("button", { name: "Search WEB" }).click();
    const dialog = page.getByRole("dialog", { name: /^Search / });
    await dialog.getByRole("searchbox", { name: "Words to find" }).fill("love one another");
    await expect(dialog.getByRole("list", { name: "Search results" }).getByRole("link").first()).toBeVisible();
    await capture(page, testInfo, "read-search", theme, false);
  });
}
