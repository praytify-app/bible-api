import { defineConfig, devices } from "@playwright/test";

// The portal runs under Vite; the API is a real local stack started with
// `scripts/dev-stack.sh up` from the repository root (gateway on :3200).
const PORT = Number(process.env.E2E_PORT ?? 5199);
const API_URL = process.env.E2E_API_URL ?? "http://localhost:3200";

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e/results",
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
  ],
  webServer: {
    command: `./node_modules/.bin/vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_URL: API_URL },
    timeout: 60_000,
  },
});
