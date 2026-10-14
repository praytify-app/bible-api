import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

// Pin the root so a pnpm-workspace.yaml in a parent directory cannot pull
// vitest's cache and config resolution outside this package.
export default defineConfig({
  root,
  cacheDir: "node_modules/.vite",
  test: {
    include: ["test/**/*.test.ts"],
    fsModuleCachePath: "node_modules/.vitest-cache",
  },
});
