import type { Locator, Page } from "@playwright/test";
import { API_URL, expect, signUp, test } from "../support/fixtures";

// Zero inert controls (BRIEF §10, qa-critic brief): every route, public and
// signed in, on both viewports. For each page, and for the menu sheet on
// phones, it enumerates every link and button and fails on:
//   - an anchor with no real href (missing, "#", or "javascript:"),
//   - an in-page "#id" link whose target does not exist,
//   - an internal link that renders the not-found page,
//   - an external link without rel="noopener noreferrer" (must-not-regress 14),
//   - an enabled button or link with no accessible name,
//   - a disabled control with no visible reason (no description, no title,
//     and not on the reviewed list below).
// It does not click every button. The Scalar reference inside /docs is the
// gateway's page and is covered by axe, not here.

const publicRoutes = [
  "/",
  "/login",
  "/docs",
  "/docs/quickstart",
  "/docs/translations",
  "/embed",
  "/read/WEB/JHN/3",
  "/read/AVD/JHN/3",
  // The first and last chapters, where the chapter arrows are at their ends.
  "/read/WEB/GEN/1",
  "/read/WEB/REV/22",
  "/no-such-page",
];
const dashboardRoutes = ["/dashboard", "/dashboard/keys", "/dashboard/usage", "/dashboard/embed", "/dashboard/settings"];

const NOT_FOUND = "We could not find that page.";

/**
 * Disabled controls reviewed by hand, with the visible reason each one shows.
 * Key: `<route> <accessible text>`.
 */
const reviewedDisabled: Record<string, string> = {
  // End-disabled arrows are required by must-not-regress 7. The h1 ("Genesis 1",
  // "Revelation 22") and the book and chapter pickers beside the arrow say why.
  "/read/WEB/GEN/1 Previous chapter": "first chapter of the Bible, named in the h1 and the pickers",
  "/read/WEB/REV/22 Next chapter": "last chapter of the Bible, named in the h1 and the pickers",
};

interface AnchorInfo {
  href: string | null;
  resolved: string;
  text: string;
  target: string;
  rel: string;
}

interface DisabledInfo {
  tag: string;
  text: string;
  describedBy: string;
  title: string;
}

async function settled(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
}

async function waitForRoute(page: Page, path: string) {
  await expect(page.locator("main").first()).toBeVisible();
  if (path.startsWith("/read/")) await expect(page.locator('[data-verse="1"]')).toBeVisible();
  if (path === "/docs") await expect(page.locator('iframe[title="Praytify Bible API reference"]')).toBeVisible();
  if (path === "/docs/translations") await expect(page.getByRole("table", { name: "Bible translations" })).toBeVisible();
  await settled(page);
}

/** Anchors and disabled controls inside `scope` (Playwright locators pierce open shadow roots). */
async function inventory(scope: Locator) {
  const anchors = await scope.locator("a").evaluateAll((els) =>
    els.map((el) => {
      const a = el as HTMLAnchorElement;
      return {
        href: a.getAttribute("href"),
        resolved: a.href,
        text: (a.getAttribute("aria-label") || a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60),
        target: a.target,
        rel: a.rel,
      } satisfies AnchorInfo;
    }),
  );
  const disabled = await scope
    .locator("button:disabled, input:disabled, select:disabled, textarea:disabled, [aria-disabled='true']")
    .evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null || el.getClientRects().length > 0)
        .map((el) => {
          const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
          const described = ids
            .map((id) => el.ownerDocument.getElementById(id)?.textContent?.trim() ?? "")
            .filter(Boolean)
            .join(" ");
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.getAttribute("aria-label") || el.textContent || (el as HTMLInputElement).placeholder || "")
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 60),
            describedBy: described,
            title: el.getAttribute("title") ?? "",
          } satisfies DisabledInfo;
        }),
    );
  return { anchors, disabled };
}

async function checkNames(scope: Locator, where: string) {
  for (const role of ["button", "link"] as const) {
    for (const control of await scope.getByRole(role).all()) {
      if (!(await control.isVisible()) || !(await control.isEnabled())) continue;
      await expect.soft(control, `${where}: ${role} without an accessible name`).toHaveAccessibleName(/\S/, {
        timeout: 2_000,
      });
    }
  }
}

async function audit(page: Page, path: string, baseURL: string, label: string) {
  const origin = new URL(baseURL).origin;
  const problems: string[] = [];
  const internal = new Map<string, string>();

  const scopes: { name: string; locator: Locator; open?: () => Promise<void>; close?: () => Promise<void> }[] = [
    { name: "page", locator: page.locator("body") },
  ];
  for (const menu of [
    { button: "Open menu", dialog: "Menu" },
    { button: "Open dashboard menu", dialog: "Dashboard menu" },
  ]) {
    const trigger = page.getByRole("button", { name: menu.button, exact: true });
    if (await trigger.isVisible()) {
      scopes.push({
        name: menu.dialog,
        locator: page.getByRole("dialog", { name: menu.dialog }),
        open: async () => {
          await trigger.click();
          await expect(page.getByRole("dialog", { name: menu.dialog })).toBeVisible();
        },
        close: async () => {
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog", { name: menu.dialog })).toBeHidden();
        },
      });
    }
  }

  for (const scope of scopes) {
    await scope.open?.();
    const where = `${path} [${label}, ${scope.name}]`;
    const { anchors, disabled } = await inventory(scope.locator);
    await checkNames(scope.locator, where);

    for (const a of anchors) {
      const href = a.href?.trim() ?? null;
      if (!href || href === "#" || href.toLowerCase().startsWith("javascript:")) {
        problems.push(`${where}: anchor "${a.text}" has no real href (${JSON.stringify(a.href)})`);
        continue;
      }
      if (href.startsWith("#")) {
        const exists = await page.locator(`[id="${href.slice(1)}"]`).count();
        if (!exists) problems.push(`${where}: in-page link "${a.text}" points at missing ${href}`);
        continue;
      }
      const url = new URL(a.resolved);
      if (url.protocol === "mailto:" || url.protocol === "tel:") continue;
      if (url.origin === origin) {
        internal.set(url.pathname + url.search, `${where} "${a.text}"`);
      } else {
        const rel = a.rel.split(/\s+/);
        if (!rel.includes("noopener") || !rel.includes("noreferrer")) {
          problems.push(`${where}: external link "${a.text}" to ${a.resolved} has rel="${a.rel}"`);
        }
      }
    }

    for (const d of disabled) {
      const key = `${path} ${d.text}`;
      if (d.describedBy || d.title || reviewedDisabled[key]) continue;
      problems.push(`${where}: disabled ${d.tag} "${d.text}" shows no reason`);
    }
    await scope.close?.();
  }

  // Internal links: each must render a real page, not the not-found route.
  for (const [target, source] of internal) {
    if (/\.[a-z0-9]+$/i.test(new URL(target, origin).pathname)) {
      const res = await page.request.get(new URL(target, origin).toString());
      if (!res.ok()) problems.push(`${source}: static link ${target} answered ${res.status()}`);
      continue;
    }
    await page.goto(target);
    await expect(page.locator("main").first()).toBeVisible();
    await settled(page);
    if (await page.getByRole("heading", { name: NOT_FOUND }).count()) {
      problems.push(`${source}: internal link ${target} renders the not-found page`);
    }
  }

  test.info().annotations.push({
    type: "inventory",
    description: `${path}: ${internal.size} internal targets checked`,
  });
  return problems;
}

for (const path of publicRoutes) {
  test(`no inert controls on ${path}`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto(path);
    await waitForRoute(page, path);
    const problems = await audit(page, path, baseURL!, testInfo.project.name);
    expect(problems).toEqual([]);
  });
}

for (const path of dashboardRoutes) {
  test(`no inert controls on ${path} (signed in)`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    await signUp(page, baseURL!);
    if (path === "/dashboard/keys") {
      // A key in the table, so its row and actions are part of the inventory.
      const res = await page.request.post(`${API_URL}/api/dashboard/keys`, {
        data: { name: "QA inventory key" },
        headers: { origin: new URL(baseURL!).origin },
      });
      expect(res.ok()).toBeTruthy();
    }
    await page.goto(path);
    await waitForRoute(page, path);
    const problems = await audit(page, path, baseURL!, testInfo.project.name);
    expect(problems).toEqual([]);
  });
}
