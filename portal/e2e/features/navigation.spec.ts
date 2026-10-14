import type { Locator, Page } from "@playwright/test";
import { API_URL, expect, expectAccessible, signUp, test, useTheme, type Theme } from "../support/fixtures";

// The shell and IA against the real local stack (BRIEF §5): every public route
// is reachable from the header on desktop and from the menu sheet on phones,
// the dashboard sidebar reaches every dashboard page with one current item,
// the guard and sign-out keep their contract (AUDIT must-not-regress 1, 15),
// and the theme choice survives a reload.

// Source links render only when the build sets VITE_SOURCE_URL (BRIEF §11).
// Playwright's web server inherits this process's environment, so the spec
// expects whatever the build under test was given.
const SOURCE_URL = process.env.VITE_SOURCE_URL?.trim().replace(/\/+$/, "").replace(/\.git$/, "") || undefined;
const SOURCE_LABEL = SOURCE_URL && new URL(SOURCE_URL).hostname === "github.com" ? "GitHub" : "Source";

/** The public "Main" nav: the header on desktop, the menu sheet on phones. */
async function openPublicNav(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole("banner").getByRole("navigation", { name: "Main" });
  await page.getByRole("button", { name: "Open menu" }).click();
  return page.getByRole("dialog", { name: "Menu" }).getByRole("navigation", { name: "Main" });
}

/** The dashboard nav: the fixed sidebar on desktop, the sheet on phones. */
async function openDashboardNav(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole("navigation", { name: "Dashboard" });
  await page.getByRole("button", { name: "Open dashboard menu" }).click();
  return page.getByRole("dialog", { name: "Dashboard menu" }).getByRole("navigation", { name: "Dashboard" });
}

/** Where Sign in or Dashboard lives: the header on desktop, the menu sheet on phones. */
async function sessionArea(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole("banner");
  await page.getByRole("button", { name: "Open menu" }).click();
  return page.getByRole("dialog", { name: "Menu" });
}

/** Wait until no region on the page is still loading. */
async function settled(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

const publicTargets = [
  { name: "Read", url: /\/read\/[A-Z0-9]+\/[A-Z0-9]{3}\/\d+$/, docs: false },
  { name: "Embed", url: /\/embed(\?.*)?$/, docs: false },
  { name: "Quick start", url: /\/docs\/quickstart$/, docs: true },
  { name: "API reference", url: /\/docs$/, docs: true },
  { name: "Translations", url: /\/docs\/translations$/, docs: true },
];

for (const target of publicTargets) {
  test(`public nav reaches ${target.name}`, async ({ page, isMobile }) => {
    await page.goto("/");
    const nav = await openPublicNav(page, isMobile);
    if (target.docs && !isMobile) {
      await nav.getByRole("button", { name: "Docs" }).click();
      await page.getByRole("menuitem", { name: new RegExp(`^${target.name}`) }).click();
    } else {
      await nav.getByRole("link", { name: target.name, exact: true }).click();
    }
    await expect(page).toHaveURL(target.url);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The item for the current page is the one current item, and says so.
    const again = await openPublicNav(page, isMobile);
    if (target.docs && !isMobile) {
      await again.getByRole("button", { name: "Docs" }).click();
      const item = page.getByRole("menuitem", { name: new RegExp(`^${target.name}`) });
      await expect(item).toHaveAttribute("aria-current", "page");
      // Real links, so they open in a new tab and preload like any other.
      await expect(item).toHaveAttribute("href", new URL(page.url()).pathname);
      await expect(page.locator('[role="menuitem"][aria-current="page"]')).toHaveCount(1);
    } else {
      await expect(again.getByRole("link", { name: target.name, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(again.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });
}

async function expectSafeExternal(link: Locator, href: string) {
  await expect(link).toHaveAttribute("href", href);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
}

test("source links appear only when a public source is configured, and open safely", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Verse of the day" })).toBeVisible();
  if (!SOURCE_URL) {
    // Nothing may point at a private or missing repository.
    await expect(page.locator('a[href*="github.com"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Run the whole thing yourself." })).toHaveCount(0);
    const nav = await openPublicNav(page, isMobile);
    await expect(nav.getByRole("link", { name: /^(GitHub|Source)/ })).toHaveCount(0);
    return;
  }
  // Footer and landing first: an open sheet hides the rest of the page from assistive technology.
  await expectSafeExternal(page.getByRole("contentinfo").getByRole("link", { name: /^Source (on GitHub|code)/ }), SOURCE_URL);
  await expectSafeExternal(page.getByRole("main").getByRole("link", { name: /^Source (on GitHub|code)/ }), SOURCE_URL);
  await expect(page.getByRole("region", { name: "Terminal example" })).toContainText(`git clone ${SOURCE_URL}.git`);
  const nav = await openPublicNav(page, isMobile);
  await expectSafeExternal(nav.getByRole("link", { name: new RegExp(`^${SOURCE_LABEL}`) }), SOURCE_URL);
});

test("a signed-out visitor is offered Sign in, which opens the login page", async ({ page, isMobile }) => {
  await page.goto("/");
  const scope = await sessionArea(page, isMobile);
  await expect(scope.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  await scope.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("the dashboard sends a visitor without a session to login and back to the page they asked for", async ({
  page,
  baseURL,
}) => {
  await page.goto("/dashboard/usage");
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get("redirect")).toBe("/dashboard/usage");
  // The guard renders nothing protected on the way out.
  await expect(page.getByRole("navigation", { name: "Dashboard" })).toHaveCount(0);

  // Once signed in, login hands them back to that page rather than the overview.
  await signUp(page, baseURL!);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard\/usage$/);
});

const dashboardTargets = [
  { name: "API keys", url: /\/dashboard\/keys$/ },
  { name: "Usage", url: /\/dashboard\/usage$/ },
  { name: "Embed", url: /\/dashboard\/embed(\?.*)?$/ },
  { name: "Settings", url: /\/dashboard\/settings$/ },
  { name: "Overview", url: /\/dashboard$/ },
];

test("the sidebar reaches every dashboard page and marks one current item", async ({ page, baseURL, isMobile }) => {
  const user = await signUp(page, baseURL!);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: `Welcome, ${user.name.split(" ")[0]}.` })).toBeVisible();

  for (const target of dashboardTargets) {
    const nav = await openDashboardNav(page, isMobile);
    await nav.getByRole("link", { name: target.name, exact: true }).click();
    await expect(page).toHaveURL(target.url);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const again = await openDashboardNav(page, isMobile);
    await expect(again.getByRole("link", { name: target.name, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(again.locator('[aria-current="page"]')).toHaveCount(1);
    if (isMobile) {
      await page.keyboard.press("Escape");
      // Let the sheet finish closing before the next pass reopens it.
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }

  // Back on the public site, the header offers the dashboard instead of Sign in.
  await page.goto("/");
  const scope = await sessionArea(page, isMobile);
  await expect(scope.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(scope.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});

test("first run offers a key and a no-key example, and plan limits come from the API", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  await page.goto("/dashboard");
  await settled(page);
  await expect(page.getByRole("heading", { name: "Create your first key." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create a key" })).toHaveAttribute("href", "/dashboard/keys");
  await expect(page.getByRole("region", { name: "cURL example" })).toContainText("/v1/verses?ref=");
  // A new account has made no requests: a real 0, not a dash.
  await expect(page.locator("dl").filter({ hasText: "Requests today" }).locator("dd").first()).toHaveText("0");
  await expect(page.getByText("Secret keys")).toBeVisible();
});

test("sign out returns to the home page and ends the session", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /^Account menu for/ }).click();
  await expect(page.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("href", "/dashboard/settings");
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new URL("/", baseURL!).href);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

// No useTheme here: its init script would force the stored choice back on reload.
// The browser reports a light colour scheme, so "match device" starts light.
test("the theme choice persists across a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("pb-theme"))).toBe("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Theme: dark" })).toBeVisible();
});

test("an unknown address gets an honest page with a way home", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { level: 1, name: /We could not find that page/ })).toBeVisible();
  // Still inside the public frame, so the rest of the site is one step away.
  await expect(page.getByRole("banner")).toBeVisible();
  await page.getByRole("link", { name: "Go to the home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the skip link moves focus to the main content", async ({ page }) => {
  await page.goto("/");
  // Keys go to whatever has rendered: wait for the page before tabbing (QA saw
  // Tab land on an empty document in 2 of 16 loads).
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("a shared verse selection stays a plain query string", async ({ page }) => {
  await page.goto("/read/WEB/JHN/3?v=16-18");
  await expect(page).toHaveURL(/\/read\/WEB\/JHN\/3\?v=16-18$/);
  await page.goto("/read/WEB/JHN/3?v=16");
  await expect(page).toHaveURL(/\/read\/WEB\/JHN\/3\?v=16$/);
});

// Chunk names are hashed in a production build, so look inside the scripts for
// a class name recharts renders: string literals survive minification.
const CHART_MARKER = "recharts-wrapper";

test("charts load only on the usage page", async ({ page, baseURL }) => {
  const chartScripts: string[] = [];
  let reading = 0;
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return;
    reading++;
    const body = await res.text().catch(() => "");
    if (body.includes(CHART_MARKER)) chartScripts.push(res.url());
    reading--;
  });
  await page.goto("/");
  await settled(page);
  await page.goto("/read/WEB/JHN/3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => reading).toBe(0);
  expect(chartScripts, "chart code loaded on a public page").toEqual([]);

  await signUp(page, baseURL!);
  // The usage route's validator keeps a non-default period in the URL.
  await page.goto("/dashboard/usage?days=7");
  await expect.poll(() => chartScripts.length).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/dashboard\/usage\?days=7$/);
});

test("every page has its own title and the reader keeps its chapter title", async ({ page, baseURL }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Praytify Bible: scripture for every app");
  await page.goto("/docs/quickstart");
  await expect(page).toHaveTitle("Quick start · Praytify Bible");
  await page.goto("/no-such-page");
  await expect(page).toHaveTitle("Page not found · Praytify Bible");
  await page.goto("/read/WEB/JHN/3");
  await expect(page).toHaveTitle(/^John 3 \(WEB\) · Praytify Bible$/);
  // Leaving the reader client-side hands the title back to the route.
  await page.getByRole("contentinfo").getByRole("link", { name: "Translations", exact: true }).click();
  await expect(page).toHaveTitle("Translations · Praytify Bible");

  await signUp(page, baseURL!);
  await page.goto("/dashboard/keys");
  await expect(page).toHaveTitle("API keys · Praytify Bible");
});

test("the landing page's catalog counts are the API's own numbers", async ({ page, request }) => {
  const versions = await (await request.get(`${API_URL}/v1/versions?limit=1`)).json();
  const languages = await (await request.get(`${API_URL}/v1/languages`)).json();
  const total: number | undefined = versions.meta?.total;
  const languageCount = (languages.data as { versionCount: number }[]).filter((l) => l.versionCount > 0).length;
  const n = new Intl.NumberFormat("en-US").format;

  await page.goto("/");
  const line =
    typeof total === "number"
      ? `${n(total)} translations in ${n(languageCount)} languages.`
      : `Scripture in ${n(languageCount)} languages.`;
  await expect(page.getByText(line)).toBeVisible();
});

for (const theme of ["light", "dark"] as Theme[]) {
  test(`home and dashboard overview pass axe in ${theme}`, async ({ page, baseURL }) => {
    await useTheme(page, theme);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Verse of the day" })).toBeVisible();
    await settled(page);
    await expectAccessible(page, `home ${theme}`);

    await signUp(page, baseURL!);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await settled(page);
    await expectAccessible(page, `dashboard overview ${theme}`);
  });
}
