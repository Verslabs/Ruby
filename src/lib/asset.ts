/**
 * Resolve a file from `public/` against Vite's configured base path.
 *
 * GitHub Pages serves this project from a subpath (`/Ruby/`), so a
 * root-absolute `/assets/3d/orb.glb` would resolve to the domain root and 404.
 * `import.meta.env.BASE_URL` is the base Vite built with, which keeps these
 * paths working unchanged in `vite dev` at `/`.
 */
const BASE = import.meta.env.BASE_URL

export function asset(path: string): string {
  return `${BASE}${path.replace(/^\//, '')}`
}