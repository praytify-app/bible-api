import { API_URL, expect, test } from "../support/fixtures";

// The reader's optional search (BRIEF §11) renders only when the build sets
// VITE_PUBLIC_SEARCH_KEY, a publishable key restricted to the portal origin.
// Playwright's web server inherits this process's environment, so the spec
// runs exactly when the build under test was given a key. Never commit one.
const SEARCH_KEY = process.env.VITE_PUBLIC_SEARCH_KEY?.trim();

test.describe("reader search", () => {
  test.skip(!SEARCH_KEY, "VITE_PUBLIC_SEARCH_KEY is not set for this build");

  test("finds verses with the publishable key and a result opens that verse", async ({ page }) => {
    const searches: { auth: string; cookie: string | undefined; status: number }[] = [];
    page.on("response", async (res) => {
      if (!res.url().startsWith(`${API_URL}/v1/search`)) return;
      const headers = await res.request().allHeaders();
      searches.push({ auth: headers.authorization ?? "", cookie: headers.cookie, status: res.status() });
    });

    await page.goto("/read/WEB/JHN/3");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("John 3");
    await page.getByRole("button", { name: "Search WEB" }).click();
    const dialog = page.getByRole("dialog", { name: /^Search / });
    await expect(dialog.getByText("Type at least two letters.")).toBeVisible();

    await dialog.getByRole("searchbox", { name: "Words to find" }).fill("love one another");
    const results = dialog.getByRole("list", { name: "Search results" });
    await expect(results.getByRole("link").first()).toBeVisible();
    await expect(dialog.getByRole("status")).toHaveText(/^\d+ results?$/);

    // Every result is a real reader link to a single verse in this translation.
    const hrefs = await results.getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    for (const href of hrefs) expect(href).toMatch(/^\/read\/WEB\/[0-9A-Z]{3}\/\d+\?v=\d+(-\d+)?$/);

    const first = results.getByRole("link").first();
    const reference = (await first.locator("span").first().textContent())!.trim();
    const [, book, chapter, verse] = reference.match(/^(.+) (\d+):(\d+)$/)!;
    await first.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${book} ${chapter}`);
    await expect(page).toHaveURL(new RegExp(`\\?v=${verse}(-${verse})?$`));
    await expect(page.getByRole("region", { name: "Selected verses" })).toBeVisible();

    expect(searches.length).toBeGreaterThan(0);
    for (const s of searches) {
      expect(s.status).toBe(200);
      expect(s.auth).toMatch(/^Bearer pb_pk_/);
      expect(s.cookie, "search must not carry the session cookie").toBeUndefined();
    }
  });

  test("says so when nothing matches", async ({ page }) => {
    await page.goto("/read/WEB/JHN/3");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("John 3");
    await page.getByRole("button", { name: "Search WEB" }).click();
    const dialog = page.getByRole("dialog", { name: /^Search / });
    await dialog.getByRole("searchbox", { name: "Words to find" }).fill("qqzxv");
    await expect(dialog.getByText("No verses in WEB match “qqzxv”.")).toBeVisible();
  });
});
