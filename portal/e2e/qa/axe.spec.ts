import type { Page } from "@playwright/test";
import { expect, expectAccessible, signUp, test, useTheme, type Theme } from "../support/fixtures";

// Axe on the pages the feature specs leave out or only check in another
// state: the bare reader (they check it with a selection), the Arabic reader
// (RTL), the dashboard's embed builder, and the not-found page. Together with
// the feature specs this covers every route in both themes.

const settled = (page: Page) => expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

const publicPages: { path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    path: "/read/WEB/JHN/3",
    ready: async (p) => {
      await expect(p.getByRole("heading", { level: 1 })).toHaveText("John 3");
      await expect(p.locator('[data-verse="1"]')).toBeVisible();
    },
  },
  {
    path: "/read/AVD/JHN/3",
    ready: async (p) => {
      await expect(p.locator('[data-verse="1"]')).toBeVisible();
      await expect(p.locator('[dir="rtl"]').first()).toBeVisible();
    },
  },
  {
    path: "/no-such-page",
    ready: (p) => expect(p.getByRole("heading", { name: "We could not find that page." })).toBeVisible(),
  },
];

for (const theme of ["light", "dark"] as Theme[]) {
  for (const { path, ready } of publicPages) {
    test(`axe ${path} (${theme})`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto(path);
      await ready(page);
      await settled(page);
      await expectAccessible(page, `${path} ${theme}`);
    });
  }

  test(`axe /dashboard/embed (${theme})`, async ({ page, baseURL }) => {
    await useTheme(page, theme);
    await signUp(page, baseURL!);
    await page.goto("/dashboard/embed");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await settled(page);
    await expectAccessible(page, `/dashboard/embed ${theme}`);
  });
}
