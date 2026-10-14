import type { Page } from "@playwright/test";
import { API_URL, expect, expectAccessible, signUp, test, useTheme, type Theme } from "../support/fixtures";

// The pages page-migration owns (login, docs, quick start, translations,
// usage, settings) against the real local gateway. Responses are stubbed only
// to reach states the local stack cannot produce on demand: a server with no
// OAuth, a failed request, or a key with traffic.

const KEY_ID = "3f2a8c1e-9b7d-4e6f-a1b2-c3d4e5f60718";

async function stubAuthMethods(page: Page, methods: { github: boolean; google: boolean; emailPassword: boolean }) {
  await page.route(`${API_URL}/api/auth-methods`, (route) => route.fulfill({ json: methods }));
}

/** A GET-only failure, so saving and other methods still reach the gateway. */
async function failGet(page: Page, url: string | RegExp) {
  await page.route(url, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR", message: "Injected by the test" } } })
      : route.fallback(),
  );
}

// --- Login -------------------------------------------------------------------

test.describe("login", () => {
  test("renders exactly the methods the server reports", async ({ page }) => {
    const methods = (await (await page.request.get(`${API_URL}/api/auth-methods`)).json()) as Record<string, boolean>;
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: /Sign in/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toHaveCount(methods.github ? 1 : 0);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(methods.google ? 1 : 0);
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(methods.emailPassword ? 1 : 0);
    await expect(page.getByText(/Terms of Service|Privacy Policy/)).toHaveCount(0);
  });

  test("shows the email form and no OAuth buttons on an email-only server", async ({ page }) => {
    await stubAuthMethods(page, { github: false, google: false, emailPassword: true });
    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with/ })).toHaveCount(0);
    await expect(page.getByRole("separator", { name: "or" })).toHaveCount(0);
  });

  test("says so when no sign-in method is configured", async ({ page }) => {
    await stubAuthMethods(page, { github: false, google: false, emailPassword: false });
    await page.goto("/login");
    await expect(page.getByText("Sign-in is not configured on this server.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveCount(0);
  });

  test("creates an account through the form and lands on the dashboard", async ({ page }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await page.goto("/login");
    await page.getByRole("button", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Create an account/ })).toBeVisible();

    await page.getByRole("textbox", { name: "Name" }).fill("Form Signup");
    await page.getByRole("textbox", { name: "Email" }).fill(`form-${id}@example.test`);
    await page.getByLabel("Password").fill("too short");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByText("Use at least 12 characters.")).toBeVisible();

    await page.getByLabel("Password").fill(`correct horse ${id}`);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Signed-in visitors bounce off the login page (must-not-regress 2).
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("shows the server's error when the email is taken", async ({ page, browser, baseURL }) => {
    const other = await browser.newPage();
    const user = await signUp(other, baseURL!);
    await other.close();

    await page.goto("/login");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Duplicate");
    await page.getByRole("textbox", { name: "Email" }).fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  for (const [target, expected] of [
    ["/dashboard/settings", "/dashboard/settings"],
    ["https://evil.example/dashboard", "/dashboard"],
  ] as const) {
    test(`after sign-in, ?redirect=${target} lands on ${expected}`, async ({ page, browser, baseURL }) => {
      const other = await browser.newPage();
      const user = await signUp(other, baseURL!);
      await other.close();

      await page.goto(`/login?redirect=${encodeURIComponent(target)}`);
      await page.getByRole("textbox", { name: "Email" }).fill(user.email);
      await page.getByLabel("Password").fill(user.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(`${baseURL}${expected}`);
    });
  }
});

// --- Docs and quick start ----------------------------------------------------------

test.describe("docs", () => {
  test("API reference loads in a sandboxed frame pinned to the portal theme", async ({ page }) => {
    await useTheme(page, "dark");
    await page.goto("/docs");
    const frame = page.locator('iframe[title="Praytify Bible API reference"]');
    await expect(frame).toHaveAttribute("sandbox", /allow-scripts/);
    await expect(frame).toHaveAttribute("src", `${API_URL}/docs?theme=dark`);
    await expect(frame).toBeVisible();
    await expect(page.getByRole("link", { name: /Open in a new tab/ })).toHaveAttribute("href", `${API_URL}/docs`);

    // Switching the portal theme reloads the reference in the new theme.
    await page.getByRole("button", { name: /^Theme:/ }).first().click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(frame).toHaveAttribute("src", `${API_URL}/docs?theme=light`);
    await expect(frame).toBeVisible();
  });

  test("API reference shows an error, not a blank frame, when the spec fails", async ({ page }) => {
    await failGet(page, `${API_URL}/v1/openapi.json`);
    await page.goto("/docs");
    await expect(page.getByText("The API reference is unavailable right now.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("quick start separates public and keyed routes and never puts a secret key in browser code", async ({ page }) => {
    await page.goto("/docs/quickstart");
    await expect(page.getByRole("heading", { level: 1, name: /Quick start/ })).toBeVisible();
    for (const name of ["Read without a key", "When you need a key", "Secret or publishable", "Rate limits", "Errors and retries", "Caching"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(page.getByRole("table", { name: "Public routes" })).toContainText("/v1/daily");
    await expect(page.getByRole("table", { name: "Routes that need a key" })).toContainText("/v1/search");
    const browserSnippet = page.getByRole("region", { name: "Browser HTML example" });
    await expect(browserSnippet).toContainText("pb_pk_");
    await expect(browserSnippet).not.toContainText("pb_sk_");
    // Signed out: the published limits.
    await expect(page.getByRole("table", { name: /^(Rate limits on this server|Published rate limits)$/ })).toContainText("20,000");
  });

  test("quick start shows the signed-in developer's own plan", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await page.goto("/docs/quickstart");
    await expect(page.getByRole("table", { name: /Your rate limits on the .* plan/ })).toBeVisible();
  });
});

// --- Translations ----------------------------------------------------------------

test.describe("translations", () => {
  test("search filters the catalog and an abbreviation opens the reader", async ({ page }) => {
    await page.goto("/docs/translations");
    const table = page.getByRole("table", { name: "Bible translations" });
    await expect(table.getByRole("link", { name: /^WEB/ })).toBeVisible();
    await expect(page.getByText(/^\d[\d,]* translations in \d[\d,]* languages/)).toBeVisible();

    await page.getByRole("searchbox", { name: "Search translations" }).fill("world english");
    await expect(table.getByRole("link")).toHaveCount(1);
    await expect(page.getByRole("status").filter({ hasText: "matching" })).toBeVisible();

    await page.getByRole("searchbox", { name: "Search translations" }).fill("no such translation zzz");
    await expect(page.getByRole("heading", { name: "No translations match" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();

    await table.getByRole("link", { name: /^WEB/ }).click();
    await expect(page).toHaveURL(/\/read\/WEB\/GEN\/1/);
  });

  test("a failed catalog load shows an error and no count", async ({ page }) => {
    await failGet(page, /\/v1\/versions\?/);
    await page.goto("/docs/translations");
    await expect(page.getByText("We could not load the translation list.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/translations in .* languages/)).toHaveCount(0);
  });
});

// --- Usage -------------------------------------------------------------------------

test.describe("usage", () => {
  test("zero-fills every day of the period and switches periods", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await page.goto("/dashboard/usage");
    await expect(page.getByRole("heading", { level: 1, name: /Usage/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Totals, last 30 days" })).toBeVisible();

    await page.getByText("Show the daily numbers").click();
    const days = page.getByRole("table", { name: /per day \(UTC\)/ }).locator("tbody tr");
    await expect(days).toHaveCount(30);

    await page.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "Last 7 days" }).click();
    await expect(page).toHaveURL(/days=7/);
    await expect(page.getByRole("heading", { name: "Totals, last 7 days" })).toBeVisible();
    // The chart remounts for the new period, so the disclosure starts closed again.
    await page.getByText("Show the daily numbers").click();
    await expect(days).toHaveCount(7);
  });

  test("a failed summary shows dashes, never zeros", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await failGet(page, /\/api\/dashboard\/usage\/summary/);
    await page.goto("/dashboard/usage");
    await expect(page.getByText("Some usage data could not be loaded.")).toBeVisible({ timeout: 15_000 });
    const requests = page.locator("dl").filter({ hasText: "Requests" }).first();
    await expect(requests).toContainText("Could not be loaded");
    await expect(requests.locator("dd").first()).not.toHaveText("0");
  });

  test("a key filter narrows the chart and can be removed", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await page.route(/\/api\/dashboard\/usage\/keys/, (route) =>
      route.fulfill({
        json: {
          period: {},
          keys: [{ keyId: KEY_ID, name: "Production server", kind: "secret", revoked: false, requests: 40, errors: 1 }],
        },
      }),
    );
    await page.goto(`/dashboard/usage?keyId=${KEY_ID}`);
    await expect(page.getByText("Key: Production server", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Chart this key/ })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Show all keys" }).click();
    await expect(page).not.toHaveURL(/keyId=/);
    await expect(page.getByText("Key: Production server", { exact: true })).toHaveCount(0);
  });

  test("a malformed key filter is dropped before it reaches the gateway", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    const sent: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/dashboard/usage")) sent.push(req.url());
    });
    await page.goto("/dashboard/usage?keyId=not-a-key");
    await expect(page.getByText(/key filter this page does not recognise/)).toBeVisible();
    expect(sent.some((url) => url.includes("not-a-key"))).toBe(false);
  });
});

// --- Settings ----------------------------------------------------------------------

test.describe("settings", () => {
  test("saves the profile and the values survive a reload", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await page.goto("/dashboard/settings");
    const name = page.getByRole("textbox", { name: "App name" });
    const url = page.getByRole("textbox", { name: "App URL" });
    await expect(name).toBeVisible();

    await url.fill("not a url");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Start the address with https:// or http://.")).toBeVisible();

    await name.fill("Psalter");
    await url.fill("https://psalter.example");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    await page.reload();
    await expect(name).toHaveValue("Psalter");
    await expect(url).toHaveValue("https://psalter.example");

    // The plan comes from the gateway, and the account section names the signed-in user.
    await expect(page.getByRole("table", { name: /Rate limits on the .* plan/ })).toBeVisible();
    await expect(page.getByText(/@example\.test$/)).toBeVisible();
  });

  test("a failed profile load blocks the form", async ({ page, baseURL }) => {
    await signUp(page, baseURL!);
    await failGet(page, `${API_URL}/api/dashboard/profile`);
    await page.goto("/dashboard/settings");
    await expect(page.getByText("Your profile could not be loaded.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "App name" })).toHaveCount(0);
  });
});

// --- Accessibility, light and dark ---------------------------------------------------

const publicPages: { path: string; ready: (page: Page) => Promise<void> }[] = [
  { path: "/login", ready: (p) => expect(p.getByRole("heading", { level: 1 })).toBeVisible() },
  { path: "/docs/quickstart", ready: (p) => expect(p.getByRole("table", { name: /^(Rate limits on this server|Published rate limits)$/ })).toBeVisible() },
  { path: "/docs/translations", ready: (p) => expect(p.getByRole("table", { name: "Bible translations" })).toBeVisible() },
];

const dashboardPages: { path: string; ready: (page: Page) => Promise<void> }[] = [
  { path: "/dashboard/usage", ready: (p) => expect(p.getByRole("img", { name: /Requests per day/ })).toBeVisible() },
  { path: "/dashboard/settings", ready: (p) => expect(p.getByRole("button", { name: "Save changes" })).toBeVisible() },
];

for (const theme of ["light", "dark"] as Theme[]) {
  for (const { path, ready } of publicPages) {
    test(`axe ${path} (${theme})`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto(path);
      await ready(page);
      await expectAccessible(page, `${path} ${theme}`);
    });
  }

  for (const { path, ready } of dashboardPages) {
    test(`axe ${path} (${theme})`, async ({ page, baseURL }) => {
      await useTheme(page, theme);
      await signUp(page, baseURL!);
      await page.goto(path);
      await ready(page);
      await expectAccessible(page, `${path} ${theme}`);
    });
  }

  // Includes the cross-origin Scalar frame: Playwright's axe runs inside it.
  test(`axe /docs (${theme})`, async ({ page }) => {
    await useTheme(page, theme);
    await page.goto("/docs");
    await expect(page.locator('iframe[title="Praytify Bible API reference"]')).toBeVisible();
    await expect(
      page.frameLocator('iframe[title="Praytify Bible API reference"]').getByRole("heading", { name: /Praytify Bible API/ }).first(),
    ).toBeVisible();
    await expectAccessible(page, `/docs ${theme}`);
  });
}
