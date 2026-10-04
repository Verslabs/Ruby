import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo from https://<user>.github.io/Ruby/, so the
  // built asset URLs need the subpath. `src/lib/asset.ts` uses BASE_URL to
  // resolve files from `public/` against it.
  base: process.env.GITHUB_ACTIONS ? '/Ruby/' : '/',
  plugins: [react(), tailwindcss()],
  build: {
    // three + drei pull in a lot of optional syntax; keep the warning threshold honest
    chunkSizeWarningLimit: 1200,
  },
})