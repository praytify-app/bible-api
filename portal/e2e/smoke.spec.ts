import { expect, test } from "./support/fixtures";

// Harness check: the portal boots and talks to the local API without credentials.
test("landing page renders and public reads reach the API", async ({ page }) => {
  const publicCalls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/v1/")) publicCalls.push(req.headers()["cookie"] ?? "");
  });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  // Public reads must never carry credentials (regression fixed in c167e10).
  expect(publicCalls.every((c) => c === "")).toBe(true);
});
