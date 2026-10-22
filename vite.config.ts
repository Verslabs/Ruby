import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from the domain root on the VPS by server/index.mjs, which also
  // mounts the Astro blog at /blog/. `src/lib/asset.ts` resolves files from
  // `public/` against this base.
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/site',
    // three + drei pull in a lot of optional syntax; keep the warning threshold honest
    chunkSizeWarningLimit: 1200,
  },
})