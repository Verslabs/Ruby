// '/blog/' in every environment; the VPS serves the site from the domain root
const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/')

export const blogUrl = (path = '') => `${BASE}${path.replace(/^\//, '')}`

// The portfolio lives one level above the blog. In dev it is a separate Vite
// server, so links and its shared assets point there instead.
const SITE = import.meta.env.DEV ? 'http://localhost:5173/' : BASE.replace(/blog\/$/, '')

export const siteUrl = (path = '') => `${SITE}${path.replace(/^\//, '')}`
