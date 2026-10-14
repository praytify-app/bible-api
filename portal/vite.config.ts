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
})
