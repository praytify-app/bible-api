import type { Page, Request } from "@playwright/test";
import { API_URL, DOCS_FRAME_TIMEOUT, expect, signUp, test } from "../support/fixtures";

// QA coverage for the AUDIT "Must not regress" items that no feature spec
// pins down on its own: the guard's pending state (1), the signed-in bounce
// off /login (2), credential-free public reads (3), the create-key error (6),
// the overview's no-fake-zeros rule (9), and revoked keys left out of the
// active count (10). Everything runs against the real local stack; only the
// failure cases stub a single response.

interface SentRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
}

/**
 * Record the headers the browser actually sent (cookies included) for every
 * completed API request the portal itself makes. Requests from the Scalar
 * frame on /docs are the gateway's own page, so only the main frame counts.
 */
function recordApiRequests(page: Page): Promise<SentRequest>[] {
  const seen: Promise<SentRequest>[] = [];
  page.on("requestfinished", (req: Request) => {
    if (!req.url().startsWith(API_URL) || req.frame() !== page.mainFrame()) return;
    seen.push(req.allHeaders().then((headers) => ({ url: req.url(), method: req.method(), headers })));
  });
  return seen;
}

async function settled(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

test("3: public reads carry no cookie and no Content-Type, even for a signed-in developer", async ({
  page,
  baseURL,
}) => {
  await signUp(page, baseURL!);
  const requests = recordApiRequests(page);

  // A credentialed page first, to prove the session cookie exists and is sent where it belongs.
  const keysLoaded = page.waitForEvent("requestfinished", (req) => req.url().startsWith(`${API_URL}/api/dashboard/keys`));
  await page.goto("/dashboard");
  await keysLoaded;

  await page.goto("/");
  await settled(page);
  await page.goto("/read/WEB/JHN/3");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("John 3");
  await page.goto("/docs/translations");
  await expect(page.getByRole("table", { name: "Bible translations" })).toBeVisible();
  await page.goto("/embed");
  await settled(page);
  await page.goto("/docs");
  await expect(page.locator('iframe[title="Praytify Bible API reference"]')).toBeVisible({ timeout: DOCS_FRAME_TIMEOUT });

  const withHeaders = await Promise.all(requests);
  const publicReads = withHeaders.filter((r) => new URL(r.url).pathname.startsWith("/v1/") && r.method === "GET");
  const dashboard = withHeaders.filter((r) => new URL(r.url).pathname.startsWith("/api/dashboard/"));

  expect(publicReads.length, "public reads observed").toBeGreaterThan(5);
  expect(
    dashboard.some((r) => r.headers.cookie),
    "the session cookie reaches /api/dashboard, so its absence below means something",
  ).toBe(true);
  const leaks = publicReads
    .filter((r) => r.headers.cookie || r.headers["content-type"])
    .map((r) => `${r.url} cookie=${Boolean(r.headers.cookie)} content-type=${r.headers["content-type"] ?? ""}`);
  expect(leaks, "public /v1 reads that carried a cookie or a Content-Type").toEqual([]);
});

test("1: the guard shows a spinner while the session resolves and never flashes dashboard content", async ({
  page,
}) => {
  // Record whether any dashboard chrome ever reaches the DOM, however briefly.
  await page.addInitScript(() => {
    const w = window as unknown as { __sawDashboard?: boolean };
    new MutationObserver(() => {
      if (document.querySelector('nav[aria-label="Dashboard"]')) w.__sawDashboard = true;
    }).observe(document, { childList: true, subtree: true });
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/auth/get-session**", async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });

  await page.goto("/dashboard/keys");
  await expect(page.getByRole("status").filter({ hasText: "Checking your session" })).toBeAttached();
  await expect(page.getByRole("heading", { name: /API keys/ })).toHaveCount(0);

  release();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard%2Fkeys$/);
  expect(await page.evaluate(() => (window as unknown as { __sawDashboard?: boolean }).__sawDashboard ?? false)).toBe(
    false,
  );
});

test("2: a signed-in developer who opens /login is sent to the dashboard", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("6: a failed key creation shows the gateway's message and keeps the dialog open", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  await page.route(`${API_URL}/api/dashboard/keys`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "KEY_LIMIT", message: "This account already has the maximum number of active keys." } }),
    });
  });
  await page.goto("/dashboard/keys");
  await page.getByRole("button", { name: /^Create (key|your first key)$/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create an API key" });
  await dialog.getByRole("textbox", { name: "Name" }).fill("QA failing key");
  await dialog.getByRole("button", { name: "Create key" }).click();
  await expect(dialog).toContainText("This account already has the maximum number of active keys.");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("revealed-key")).toHaveCount(0);
});

test("9: the overview shows dashes, never zeros, when the usage summary fails", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  await page.route(`${API_URL}/api/dashboard/usage/summary**`, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL", message: "Usage is unavailable." } }),
    }),
  );
  await page.goto("/dashboard");
  for (const label of ["Requests today", "Requests", "Errors"]) {
    const stat = page.locator("dl").filter({ has: page.getByText(label, { exact: true }) });
    const value = stat.locator("dd").first();
    await expect(value).toContainText("—");
    await expect(value).not.toHaveText(/^\s*0\s*$/);
  }
});

test("10: revoked keys are left out of the active count", async ({ page, baseURL }) => {
  await signUp(page, baseURL!);
  const origin = new URL(baseURL!).origin;
  const create = async (name: string) => {
    const res = await page.request.post(`${API_URL}/api/dashboard/keys`, { data: { name }, headers: { origin } });
    expect(res.ok()).toBeTruthy();
    return ((await res.json()) as { key: { id: string } }).key.id;
  };
  await create("QA kept key");
  const doomed = await create("QA revoked key");
  const revoked = await page.request.delete(`${API_URL}/api/dashboard/keys/${doomed}`, { headers: { origin } });
  expect(revoked.ok()).toBeTruthy();

  await page.goto("/dashboard");
  const active = page.locator("dl").filter({ has: page.getByText("Active keys", { exact: true }) });
  await expect(active.locator("dd").first()).toHaveText("1");

  await page.goto("/dashboard/keys");
  await expect(page.locator("tbody tr", { hasText: "QA kept key" })).toHaveCount(1);
  await expect(page.locator("tbody tr", { hasText: "QA revoked key" })).toHaveCount(0);
});
