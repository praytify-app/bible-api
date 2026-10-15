import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // One import surface for the design system: `@/components/ds`.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Never inline fonts as data: URIs. The production CSP is font-src 'self',
    // so an inlined subset (Vite inlines anything under 4 KB by default) is
    // blocked and that unicode range falls back to a system font. Other assets
    // keep Vite's default.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  server: {
    watch: {
      // Playwright writes traces and reports inside the project. Watching them
      // made Vite full-reload the page under test mid-run.
      ignored: ['**/e2e/results/**', '**/playwright-report/**', '**/test-results/**'],
    },
  },
})
