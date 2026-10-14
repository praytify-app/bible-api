import type { Page } from "@playwright/test";
import { expect, expectAccessible, signUp, test, useTheme, type Theme } from "../support/fixtures";

// The embed builder end to end against the real local gateway: the preview is
// the shipped /embed/v1.js, and the snippet it hands out must render the same
// passage on a page that has nothing to do with the portal.

const JOHN_3_16 = "/embed?ref=John%203:16&version=WEB";

/** The widget renders in an open shadow root; Playwright's CSS locators pierce it. */
const preview = (page: Page) => page.locator("praytify-verse, praytify-daily");

async function openBuilder(page: Page, path = JOHN_3_16) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: /Scripture on any page/ })).toBeVisible();
}

async function choose(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field }).click();
  await page.getByRole("option", { name: option }).click();
}

test("prefills from the reader's link and previews the real widget", async ({ page }) => {
  await openBuilder(page);
  const reference = page.getByRole("textbox", { name: "Reference" });
  await expect(reference).toHaveValue("John 3:16");
  await expect(reference).toHaveAccessibleDescription("Found John 3:16 (WEB), 1 verse.");
  await expect(preview(page).locator("blockquote")).toContainText("For God so loved the world");
  await expect(preview(page).locator("cite")).toHaveText("John 3:16 (WEB)");
  await expect(preview(page).getByRole("link", { name: "Read the chapter" })).toHaveAttribute(
    "href",
    /\/read\/WEB\/JHN\/3$/,
  );
});

test("copies a snippet that renders the same passage on a blank page", async ({ page, context, baseURL }) => {
  const portal = new URL(baseURL!);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: portal.origin });
  await openBuilder(page);
  await expect(preview(page).locator("cite")).toHaveText("John 3:16 (WEB)");

  // Theme reaches the live element, the URL, and the snippet.
  await expect(preview(page)).toHaveAttribute("theme", "auto");
  await choose(page, "Theme", "Dark");
  await expect(preview(page)).toHaveAttribute("theme", "dark");
  await expect(page).toHaveURL(/theme=dark/);

  await page.getByRole("button", { name: "Copy HTML code" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Copied to clipboard" })).toBeAttached();
  const snippet = await page.evaluate(() => navigator.clipboard.readText());
  expect(snippet).toContain(`<script type="module" src="${portal.origin}/embed/v1.js"></script>`);
  expect(snippet).toContain('theme="dark"');

  // A blank page on a different origin (127.0.0.1 rather than localhost), so
  // the module script loads cross-origin the way it does on an integrator's
  // site. The routed page has no address of its own, so Chrome treats it as
  // public and asks before it reaches loopback; production hosts are public
  // and praytify.bible is too, so granting that here changes nothing real.
  const host = `http://127.0.0.1:${portal.port}/__embed-host`;
  await context.grantPermissions(["local-network-access"], { origin: new URL(host).origin });
  await page.route(host, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Blank</title>" }),
  );
  await page.goto(host);
  await page.setContent(
    `<!doctype html><html lang="en"><head><title>Host page</title></head><body><main>${snippet}</main></body></html>`,
  );
  const pasted = page.locator("praytify-verse");
  await expect(pasted.locator("cite")).toHaveText("John 3:16 (WEB)");
  await expect(pasted.locator("blockquote")).toContainText("For God so loved the world");
  await expect(pasted).toHaveAttribute("theme", "dark");
});

test("searches the catalog by keyboard and switches translation", async ({ page }) => {
  await openBuilder(page);
  await page.getByRole("button", { name: /^Translation World English Bible/ }).click();
  const search = page.getByRole("combobox", { name: "Search translations" });
  await search.fill("king");
  await expect(page.getByRole("option", { name: /King James Version \(KJV\)/ })).toBeVisible();
  await search.press("Enter");
  await expect(preview(page).locator("cite")).toHaveText("John 3:16 (KJV)");
  await expect(page).toHaveURL(/version=KJV/);
  await expect(page.getByRole("region", { name: "HTML example" })).toContainText('version="KJV"');
});

test("reports a reference the API cannot resolve, in the API's words", async ({ page }) => {
  await openBuilder(page);
  const reference = page.getByRole("textbox", { name: "Reference" });
  await reference.fill("Hezekiah 1:1");
  await expect(reference).toHaveAccessibleDescription(/Book 'Hezekiah' not found in WEB/);
  await expect(reference).toHaveAttribute("aria-invalid", "true");
  // The preview shows what a visitor would see with that snippet.
  await expect(preview(page).locator(".status")).toContainText("Could not load this passage");
});

test("warns when attribution is turned off, and the choice survives a reload", async ({ page }) => {
  await openBuilder(page);
  await expect(preview(page).getByRole("link", { name: /World English Bible/ })).toBeVisible();

  await page.getByRole("switch", { name: "Attribution" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check the licence first" })).toBeVisible();
  await expect(preview(page).locator("cite")).toHaveText("John 3:16 (WEB)");
  await expect(preview(page).getByRole("link", { name: /World English Bible/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "HTML example" })).toContainText('attribution="false"');

  await expect(page).toHaveURL(/attribution=false/);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Attribution" })).not.toBeChecked();
  await expect(preview(page)).toHaveAttribute("attribution", "false");
});

test("switches to the verse of the day", async ({ page }) => {
  await openBuilder(page);
  await choose(page, "Widget", "Verse of the day");
  await expect(page.getByRole("textbox", { name: "Reference" })).toHaveCount(0);
  const daily = page.locator("praytify-daily");
  await expect(daily.locator("cite")).toContainText("(WEB)");
  await expect(page.getByText(/^Today it shows .+ \(WEB\)\./)).toBeVisible();
  await page.getByRole("tab", { name: "SDK" }).click();
  await expect(page.getByRole("region", { name: "SDK example" })).toContainText('bible.daily({ version: "WEB" })');
});

test("works inside the dashboard, pointing at the key manager", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  await openBuilder(page, "/dashboard/embed?ref=Romans%208:28&version=KJV");
  await expect(preview(page).locator("cite")).toHaveText("Romans 8:28 (KJV)");
  await expect(page.getByRole("link", { name: "Create an API key" })).toHaveAttribute("href", "/dashboard/keys");
});

for (const theme of ["light", "dark"] as Theme[]) {
  test(`has no serious accessibility violations (${theme})`, async ({ page }) => {
    await useTheme(page, theme);
    await openBuilder(page);
    await expect(preview(page).locator("cite")).toHaveText("John 3:16 (WEB)");
    await expectAccessible(page, `/embed ${theme}`);
  });
}
