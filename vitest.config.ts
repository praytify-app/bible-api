import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Pin the root and caches to this repo: vitest 5 otherwise resolves its module
// cache from the nearest pnpm workspace, which can be a parent directory.
export default defineConfig({
  root,
  cacheDir: "node_modules/.vite",
  test: {
    include: ["tests/**/*.test.ts"],
    // Integration suites create and drop databases; give them room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    exclude: ["**/node_modules/**", ".worktrees/**", "portal/**", "packages/**"],
    fsModuleCachePath: "node_modules/.vitest-cache",
    env: { LOG_LEVEL: process.env.LOG_LEVEL ?? "silent" },
  },
});
