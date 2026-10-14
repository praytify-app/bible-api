import { fileURLToPath, URL } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

export default mergeConfig(
  viteConfig,
  defineConfig({
    // Pinned so vitest never resolves a cache under ~/node_modules (EPERM in the sandbox
    // and a stray ~/pnpm-workspace.yaml on the dev machine).
    root,
    cacheDir: 'node_modules/.vite',
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      fsModuleCachePath: 'node_modules/.vitest-cache',
      restoreMocks: true,
      unstubGlobals: true,
    },
  }),
)
