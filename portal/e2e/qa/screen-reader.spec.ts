import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { API_URL, expect, signUp, test } from "../support/fixtures";

// What a screen reader user navigates by. axe files these rules under best
// practice, so the WCAG-tag gate in expectAccessible never runs them: one h1,
// headings in order, one main, unique top-level landmarks, all content inside
// a landmark, a skip link that works. Then the two things a single-page app
// has to do by hand: say where a client-side navigation landed, and leave
// focus alone on a control that survives it (route-focus.ts).
//
// ARIA_SNAPSHOT_DIR=<dir> also writes each page's accessibility tree as YAML,
// the closest thing to hearing it read, for review.

const STRUCTURE_RULES = [
  "page-has-heading-one",
  "heading-order",
  "empty-heading",
  "landmark-one-main",
  "landmark-unique",
  "landmark-no-duplicate-banner",
  "landmark-no-duplicate-contentinfo",
  "landmark-no-duplicate-main",
  "landmark-banner-is-top-level",
  "landmark-contentinfo-is-top-level",
  "landmark-main-is-top-level",
  "landmark-complementary-is-top-level",
  "region",
  "bypass",
  "skip-link",
];

const settled = (page: Page) => expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });

/** Any violation fails, whatever its impact: these rules are the page outline. */
async function expectStructure(page: Page, testInfo: TestInfo, slug: string) {
  await settled(page);
  // The API reference frame is Scalar's document, not ours.
  const results = await new AxeBuilder({ page }).withRules(STRUCTURE_RULES).exclude("iframe").analyze();
  const found = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(found, `structure of ${slug}`).toEqual([]);

  const dir = process.env.ARIA_SNAPSHOT_DIR;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, `${slug}-${testInfo.project.name}.yml`), await page.locator("body").ariaSnapshot());
  }
}

const h1 = (page: Page) => page.getByRole("main").getByRole("heading", { level: 1 });

const publicRoutes = [
  { slug: "home", path: "/" },
  { slug: "login", path: "/login" },
  { slug: "docs", path: "/docs" },
  { slug: "quickstart", path: "/docs/quickstart" },
  { slug: "translations", path: "/docs/translations" },
  { slug: "embed", path: "/embed" },
  { slug: "read", path: "/read/WEB/JHN/3" },
  { slug: "read-rtl", path: "/read/AVD/JHN/3" },
  { slug: "not-found", path: "/no-such-page" },
];

const dashboardRoutes = [
  { slug: "dashboard", path: "/dashboard" },
  { slug: "keys", path: "/dashboard/keys" },
  { slug: "usage", path: "/dashboard/usage" },
  { slug: "dashboard-embed", path: "/dashboard/embed" },
  { slug: "settings", path: "/dashboard/settings" },
];

test.describe("screen reader structure", () => {
  for (const { slug, path: route } of publicRoutes) {
    test(`outline of ${slug}`, async ({ page }, testInfo) => {
      await page.goto(route);
      await expect(h1(page)).toBeVisible();
      await expectStructure(page, testInfo, slug);
    });
  }

  test("outline of every dashboard page", async ({ page, baseURL }, testInfo) => {
    await signUp(page, baseURL!);
    await page.goto("/dashboard");
    await expect(h1(page)).toBeVisible();
    await expectStructure(page, testInfo, "dashboard-first-run");

    const res = await page.request.post(`${API_URL}/api/dashboard/keys`, {
      data: { name: "Production web app" },
      headers: { origin: new URL(baseURL!).origin },
    });
    expect(res.ok()).toBeTruthy();
    for (const { slug, path: route } of dashboardRoutes) {
      await test.step(slug, async () => {
        await page.goto(route);
        await expect(h1(page)).toBeVisible();
        await expectStructure(page, testInfo, slug);
      });
    }
  });
});

test.describe("keyboard and announcements", () => {
  // Safari only tabs to links with Option+Tab or a system setting.
  test.skip(({ browserName }) => browserName === "webkit", "WebKit skips links on Tab by default");

  for (const route of ["/", "/dashboard"]) {
    test(`skip link is the first stop on ${route}`, async ({ page, baseURL }) => {
      if (route === "/dashboard") await signUp(page, baseURL!);
      await page.goto(route);
      await expect(h1(page)).toBeVisible();
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to main content" });
      await expect(skip).toBeFocused();
      await expect(skip).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
    });
  }
});

test.describe("route changes", () => {
  test("a navigation link moves focus to the new page's heading", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(h1(page)).toBeVisible();
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Embed", exact: true }).click();
    } else {
      await page.getByRole("banner").getByRole("link", { name: "Embed", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/embed(\?.*)?$/);
    await expect(h1(page)).toBeFocused();
  });

  test("paging the reader keeps focus on the button and announces the chapter", async ({ page }) => {
    await page.goto("/read/WEB/JHN/3");
    await expect(h1(page)).toHaveText("John 3");
    await settled(page);
    const next = page.getByRole("button", { name: "Next chapter" });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(h1(page)).toHaveText("John 4");
    await expect(page.getByRole("status").filter({ hasText: /^John 4$/ })).toBeAttached();
    await expect(next).toBeFocused();
  });

  test("the first load leaves focus where the browser put it", async ({ page }) => {
    await page.goto("/docs/quickstart");
    await expect(h1(page)).toBeVisible();
    await settled(page);
    await expect(h1(page)).not.toBeFocused();
  });
});
