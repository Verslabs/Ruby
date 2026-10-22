// Production server for the VPS: one Node process for the whole site.
//
//   /blog/*   the Astro blog (pages, editor API, uploaded media)
//   anything  the static portfolio built by Vite
//
// Run `npm run build` first, then `npm start`. It listens on 127.0.0.1:4000 by
// default and expects a reverse proxy (Caddy, nginx) in front for HTTPS.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handler as blog } from '../dist/blog/server/entry.mjs'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const SITE_DIR = path.join(DIST, 'site')
const BLOG_CLIENT_DIR = path.join(DIST, 'blog', 'client')
const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '127.0.0.1'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
}

/** A file under `root` for this URL path, or null. Refuses to leave `root`. */
async function findFile(root, urlPath) {
  let decoded
  try {
    decoded = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  const file = path.resolve(root, `.${decoded}`)
  if (file !== root && !file.startsWith(root + path.sep)) return null
  try {
    const info = await stat(file)
    if (info.isFile()) return { file, size: info.size }
    if (info.isDirectory()) {
      const index = path.join(file, 'index.html')
      const indexInfo = await stat(index)
      if (indexInfo.isFile()) return { file: index, size: indexInfo.size }
    }
  } catch {
    // not there
  }
  return null
}

// Build output with a content hash in the name never changes, so it can be
// cached forever. Everything else is revalidated.
const cacheControl = (urlPath) =>
  /\/_astro\//.test(urlPath) || /^\/assets\/[^/]+-[\w-]{8}\.(js|css)$/.test(urlPath)
    ? 'public, max-age=31536000, immutable'
    : urlPath.endsWith('.html') || !path.extname(urlPath)
      ? 'no-cache'
      : 'public, max-age=3600'

function sendFile(req, res, { file, size }, urlPath) {
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': cacheControl(urlPath),
  })
  if (req.method === 'HEAD') return res.end()
  createReadStream(file).pipe(res)
}

function notFound(res) {
  res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('Not found')
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * The visitor's address for the login rate limit. Behind the local reverse
 * proxy every request comes from loopback, so trust X-Forwarded-For only then.
 */
function clientIp(req) {
  const remote = req.socket.remoteAddress ?? 'unknown'
  const forwarded = req.headers['x-forwarded-for']
  if (LOOPBACK.has(remote) && typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return remote
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    const readOnly = req.method === 'GET' || req.method === 'HEAD'

    if (pathname === '/blog') {
      res.writeHead(301, { Location: '/blog/' })
      return res.end()
    }

    if (pathname.startsWith('/blog/')) {
      // the blog's built CSS and JS, then everything else goes to Astro
      if (readOnly && pathname.startsWith('/blog/_astro/')) {
        const asset = await findFile(BLOG_CLIENT_DIR, pathname.slice('/blog'.length))
        return asset ? sendFile(req, res, asset, pathname) : notFound(res)
      }
      return blog(req, res, () => notFound(res), { clientIp: clientIp(req) })
    }

    if (!readOnly) {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' })
      return res.end()
    }

    const file = await findFile(SITE_DIR, pathname)
    if (file) return sendFile(req, res, file, pathname)
    // the portfolio is a single page, so unknown routes get it too
    if (!path.extname(pathname)) {
      const index = await findFile(SITE_DIR, '/index.html')
      if (index) return sendFile(req, res, index, '/index.html')
    }
    return notFound(res)
  } catch (error) {
    console.error(error)
    if (!res.headersSent) res.writeHead(500)
    res.end()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Ruby is listening on http://${HOST}:${PORT}`)
})

// let systemd stop the service cleanly
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
