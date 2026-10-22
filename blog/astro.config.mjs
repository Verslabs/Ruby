import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, envField } from 'astro/config'

// The blog runs on the VPS as part of server/index.mjs, mounted at /blog/.
// Pages render per request so a post saved in the editor is live at once.
export default defineConfig({
  base: '/blog/',
  outDir: '../dist/blog',
  output: 'server',
  adapter: node({
    mode: 'middleware',
    // the largest legitimate request is a post with a cover image
    bodySizeLimit: 16 * 1024 * 1024,
  }),
  server: { port: 4321 },
  env: {
    schema: {
      // posts, images, staff accounts and sessions; e.g. postgres://ruby@localhost/ruby_blog
      DATABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
