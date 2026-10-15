import { defineConfig, devices } from "@playwright/test";

// The portal runs under Vite; the API is a real local stack started with
// `scripts/dev-stack.sh up` from the repository root (gateway on :3200).
const PORT = Number(process.env.E2E_PORT ?? 5199);
const API_URL = process.env.E2E_API_URL ?? "http://localhost:3200";
// E2E_MODE=preview tests the production build (what ships) and avoids the
// dev server's reloads when other files change mid-run.
const PREVIEW = process.env.E2E_MODE === "preview";
// Preview serves its own build folder. Sharing dist/ let any other `vite build`
// (with a different VITE_API_URL) swap the bundle under a running suite.
const DIST = process.env.E2E_DIST_DIR ?? "dist-e2e";

export default defineConfig({
  testDir: "e2e",
  outputDir: process.env.E2E_OUTPUT_DIR ?? "e2e/results",
  timeout: 30_000,
  expect: { timeout: 7_500 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    // E2E_BROWSERS=all adds Firefox and WebKit (Safari's engine, desktop and
    // iPhone). Opt-in because they need `playwright install firefox webkit`.
    ...(process.env.E2E_BROWSERS === "all"
      ? [
          // Each Playwright call costs 8 to 33 ms over Firefox's protocol against
          // 1 to 2 ms in Chromium (measured here), and the action-heavy specs
          // (inert-controls walks every control) make hundreds. More time, same assertions.
          {
            name: "firefox",
            timeout: 60_000,
            expect: { timeout: 15_000 },
            use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } },
          },
          { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
          { name: "iphone", use: { ...devices["iPhone 15"], viewport: { width: 390, height: 844 } } },
        ]
      : []),
  ],
  webServer: {
    command: PREVIEW
      ? `./node_modules/.bin/vite build --outDir ${DIST} --emptyOutDir && ./node_modules/.bin/vite preview --outDir ${DIST} --port ${PORT} --strictPort`
      : `./node_modules/.bin/vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: API_URL },
    timeout: PREVIEW ? 180_000 : 60_000,
  },
});
