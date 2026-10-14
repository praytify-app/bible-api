import type { Page } from "@playwright/test";
import { clipboardReader, expect, expectAccessible, test, useTheme, type Theme } from "../support/fixtures";

// The public reader against the real local stack (BRIEF §6.1): chapter
// navigation across books, switching translation in place, verse selection
// with copy and share links that round-trip, reading settings that survive a
// reload, /read resuming the last chapter, and the honest error states
// (AUDIT must-not-regress 7). The stack seeds WEB, KJV and AVD (Arabic, RTL).

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const verseButton = (page: Page, n: number) => page.getByRole("button", { name: `Verse ${n}`, exact: true });
const toolbar = (page: Page) => page.getByRole("region", { name: "Selected verses" });

async function openChapter(page: Page, path: string, title: string) {
  await page.goto(path);
  await expect(heading(page)).toHaveText(title);
  await expect(verseButton(page, 1)).toBeVisible();
}

/** Click or tap the verse text itself (its last line), the way a reader would. */
async function pressVerseText(page: Page, verse: number, isMobile: boolean, shift = false) {
  const point = await page.locator(`[data-verse="${verse}"]`).evaluate((el) => {
    el.scrollIntoView({ block: "center" });
    const rects = el.getClientRects();
    const last = rects[rects.length - 1];
    return { x: last.left + last.width / 2, y: last.top + last.height / 2 };
  });
  if (isMobile) return page.touchscreen.tap(point.x, point.y);
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y);
  if (shift) await page.keyboard.up("Shift");
}

async function expectSelected(page: Page, verses: number[], notSelected: number[]) {
  for (const n of verses) await expect(verseButton(page, n)).toHaveAttribute("aria-pressed", "true");
  for (const n of notSelected) await expect(verseButton(page, n)).toHaveAttribute("aria-pressed", "false");
}

test.describe("reader", () => {
  test("moves between chapters and across a book boundary", async ({ page, isMobile }) => {
    await openChapter(page, "/read/WEB/JHN/3", "John 3");
    await expect(page).toHaveTitle("John 3 (WEB) · Praytify Bible");

    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(heading(page)).toHaveText("John 4");
    if (!isMobile) {
      // Arrow keys step chapters when focus is not in a control.
      // Focus is on the Next button, which does not use arrow keys.
      await page.keyboard.press("ArrowLeft");
      await expect(heading(page)).toHaveText("John 3");
    }

    // The chapter picker, then across the end of John into Acts and back.
    await page.getByRole("combobox", { name: "Chapter" }).click();
    await page.getByRole("option", { name: "21", exact: true }).click();
    await expect(page).toHaveURL(/\/read\/WEB\/JHN\/21$/);
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(heading(page)).toHaveText("Acts 1");
    await page.getByRole("navigation", { name: "Chapters" }).getByRole("link", { name: /John 21/ }).click();
    await expect(heading(page)).toHaveText("John 21");
  });

  test("switching translation keeps the book and chapter", async ({ page }) => {
    await openChapter(page, "/read/WEB/JHN/3", "John 3");
    await page.getByRole("button", { name: /^Translation/ }).click();
    // Two letters or more search on the server.
    await page.getByRole("combobox", { name: "Search translations" }).fill("King");
    await page.getByRole("option", { name: /KJV · King James Version/ }).click();

    await expect(page).toHaveURL(/\/read\/KJV\/JHN\/3$/);
    await expect(heading(page)).toHaveText("John 3");
    await expect(page.getByText("King James Version", { exact: true }).first()).toBeVisible();
    await expect(verseButton(page, 16)).toBeVisible();

    // RTL translation: scripture carries its language and direction; navigation stays LTR.
    await page.goto("/read/AVD/JHN/3");
    // The engine's "arb" (ISO 639-3) is declared as BCP 47 "ar".
    await expect(page.locator('[lang="ar"][dir="rtl"]').first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Chapters" })).toHaveAttribute("dir", "ltr");
    await expect(page.getByText("Public Domain", { exact: false }).first()).toBeVisible();
  });

  test("Enter in the translation search picks the match before the server answers", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard path");
    await openChapter(page, "/read/WEB/JHN/3", "John 3");
    const picker = page.getByRole("button", { name: /^Translation/ });
    const box = page.getByRole("combobox", { name: "Search translations" });

    // Inside the 250 ms debounce: no request has gone out yet.
    const catalog = page.waitForResponse((r) => r.url().endsWith("/v1/versions?limit=2000"));
    await picker.click();
    await catalog;
    await box.fill("King");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/read\/KJV\/JHN\/3$/);

    // Waiting on the server: its answer is held (a real response, delayed) so Enter lands first.
    await page.route(
      (url) => url.searchParams.get("search") === "World",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      },
    );
    await picker.click();
    const held = page.waitForRequest((r) => new URL(r.url()).searchParams.get("search") === "World");
    await box.fill("World");
    await held;
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/read\/WEB\/JHN\/3$/);
  });

  test("a selected range copies with attribution and shares a link that highlights it", async ({
    page,
    isMobile,
    baseURL,
    browserName,
  }) => {
    const readClipboard = await clipboardReader(page, browserName, baseURL!);
    await openChapter(page, "/read/WEB/JHN/3", "John 3");

    await pressVerseText(page, 16, isMobile);
    // Touch has no shift key: tapping a second verse grows the range to include it.
    await pressVerseText(page, 18, isMobile, true);
    await expect(toolbar(page)).toContainText("John 3:16-18 (WEB)");
    await expectSelected(page, [16, 17, 18], [15, 19]);
    await expect(page.getByRole("status").filter({ hasText: "Verses 16 to 18 selected" })).toBeAttached();

    // By position: both copy buttons read "Copied" for two seconds after use.
    const copyText = toolbar(page).getByRole("button").nth(0);
    const copyLink = toolbar(page).getByRole("button").nth(1);
    await expect(copyText).toHaveAccessibleName("Copy");
    await copyText.click();
    await expect(copyText).toHaveAccessibleName("Copied");
    const copied = await readClipboard();
    expect(copied).toMatch(/^16 For God so loved the world/);
    expect(copied).toContain("John 3:16-18 (WEB)");
    expect(copied).toContain("Public Domain");

    await expect(copyLink).toHaveAccessibleName("Copy link");
    await copyLink.click();
    await expect(copyLink).toHaveAccessibleName("Copied");
    const link = await readClipboard();
    expect(link).toBe(`${baseURL}/read/WEB/JHN/3?v=16-18`);

    await expect(toolbar(page).getByRole("link", { name: "Embed" })).toHaveAttribute(
      "href",
      "/embed?ref=JHN%203%3A16-18&version=WEB",
    );

    // A visitor opening the shared link lands on the highlighted verses.
    await page.goto(link);
    await expect(heading(page)).toHaveText("John 3");
    await expectSelected(page, [16, 17, 18], [15, 19]);
    await expect(page.locator('[data-verse="16"]')).toBeInViewport();
    await expect(toolbar(page)).toContainText("John 3:16-18 (WEB)");

    // Escape clears, and focus stays in the text.
    await toolbar(page).getByRole("button", { name: "Clear selection" }).focus();
    await page.keyboard.press("Escape");
    await expect(toolbar(page)).toHaveCount(0);
    await expectSelected(page, [], [16, 17, 18]);
  });

  test("verses can be selected from the keyboard", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard path; the touch path is covered above");
    await openChapter(page, "/read/WEB/JHN/3", "John 3");
    await verseButton(page, 1).focus();
    await page.keyboard.press("End");
    await expect(verseButton(page, 36)).toBeFocused();
    await page.keyboard.press("Home");
    for (let i = 1; i < 16; i++) await page.keyboard.press("ArrowDown");
    await expect(verseButton(page, 16)).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Shift+Enter");
    await expectSelected(page, [16, 17, 18], [15, 19]);
    // One tab stop for the whole chapter.
    await expect(page.locator("[data-verse-button][tabindex='0']")).toHaveCount(1);
  });

  test("text size, theme and verse numbers persist across a reload", async ({ page }) => {
    await openChapter(page, "/read/WEB/JHN/3", "John 3");
    await page.getByRole("button", { name: "Reading settings" }).click();
    const settings = page.getByRole("dialog", { name: "Reading settings" });
    await settings.getByRole("button", { name: "Larger text" }).click();
    await settings.getByRole("button", { name: "Larger text" }).click();
    await expect(settings.locator("output")).toHaveText("125%");
    await settings.getByRole("button", { name: "Dark" }).click();
    await settings.getByRole("switch", { name: "Verse numbers" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.keyboard.press("Escape");

    await page.reload();
    await expect(heading(page)).toHaveText("John 3");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('[style*="--reader-scale"]')).toHaveAttribute("style", /--reader-scale:\s*1\.25/);
    await expect(verseButton(page, 1)).toHaveClass(/sr-only/);
    await page.getByRole("button", { name: "Reading settings" }).click();
    await expect(settings.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    await expect(settings.getByRole("switch", { name: "Verse numbers" })).toHaveAttribute("aria-checked", "false");
  });

  test("/read resumes the last chapter read", async ({ page }) => {
    await openChapter(page, "/read/KJV/PSA/23", "Psalms 23");
    await page.goto("/read");
    await expect(page).toHaveURL(/\/read\/KJV\/PSA\/23$/);
    await expect(heading(page)).toHaveText("Psalms 23");
  });

  test("honest states for missing books, missing chapters and rate limits", async ({ page }) => {
    // A book the translation lacks (the catalog links every version to Genesis 1,
    // and some are New Testament only) lands on its first book, with a note.
    await page.goto("/read/WEB/TOB/1");
    await expect(page).toHaveURL(/\/read\/WEB\/GEN\/1$/);
    await expect(heading(page)).toHaveText("Genesis 1");
    await expect(page.getByText("WEB does not include TOB, so you are at Genesis 1.")).toBeVisible();

    await page.goto("/read/WEB/JHN/40");
    await expect(page.getByRole("heading", { level: 2, name: "John has 21 chapters in WEB" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to John 21" })).toBeVisible();

    // A 429 cannot be produced on demand from the shared stack, so this one
    // response is stubbed; everything else on the page is real.
    await page.route("**/v1/chapters/WEB/JHN/2/verses", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Expose-Headers": "Retry-After",
          "Retry-After": "30",
        },
        body: JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }),
      }),
    );
    await page.goto("/read/WEB/JHN/2");
    const alert = page.getByRole("alert").filter({ hasText: "We couldn't load John 2 in WEB." });
    await expect(alert).toContainText("Try again in 30 seconds.");
  });

  for (const theme of ["light", "dark"] as Theme[]) {
    test(`has no serious axe violations in ${theme}, with a selection`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto("/read/WEB/JHN/3?v=16-18");
      await expect(toolbar(page)).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expectAccessible(page, `reader ${theme}`);
    });
  }
});
