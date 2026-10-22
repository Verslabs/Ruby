// Copies Markdown posts (and their images) from the old file-based blog into
// the database.
//
//   npm run blog:import                 # reads blog/data
//   npm run blog:import -- /var/lib/ruby/blog
//
// The folder holds posts/*.md and, optionally, media/*. A post or image that
// is already in the database is left alone, so running it twice is safe.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { argv } from 'node:process'
import { connect } from './db.mjs'

const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/
const MEDIA_NAME = /^[a-z0-9][a-z0-9-]{0,120}\.(png|jpe?g|webp|gif)$/
const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

const dir = path.resolve(argv[2] ?? 'blog/data')

const list = (folder) =>
  readdir(path.join(dir, folder)).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })

// Same reading rules as blog/src/lib/frontmatter.ts.
function parsePost(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  const fields = {}
  for (const line of (match?.[1] ?? '').split(/\r?\n/)) {
    const pair = line.match(/^(\w+):\s*(.*)$/)
    if (!pair) continue
    const value = pair[2].trim()
    try {
      fields[pair[1]] = value.startsWith('"') ? JSON.parse(value) : value.replace(/^'(.*)'$/, '$1')
    } catch {
      fields[pair[1]] = value
    }
  }
  return { fields, body: (match?.[2] ?? text).trim() }
}

const client = await connect()
let posts = 0
let images = 0
try {
  for (const file of await list('posts')) {
    const slug = file.replace(/\.md$/, '')
    if (!file.endsWith('.md') || !SLUG.test(slug)) continue
    const { fields, body } = parsePost(await readFile(path.join(dir, 'posts', file), 'utf8'))
    const date = (fields.date ?? '').slice(0, 10)
    if (!fields.title || Number.isNaN(Date.parse(date))) {
      console.warn(`Skipped ${file}: it needs a title and a date.`)
      continue
    }
    const { rowCount } = await client.query(
      `INSERT INTO posts (slug, title, description, date, cover, draft, body)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (slug) DO NOTHING`,
      [slug, fields.title, fields.description ?? '', date, fields.cover || null, fields.draft === 'true', body],
    )
    posts += rowCount
  }

  for (const file of await list('media')) {
    if (!MEDIA_NAME.test(file)) continue
    const { rowCount } = await client.query(
      'INSERT INTO media (name, content_type, bytes) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [file, TYPES[file.split('.').pop()], await readFile(path.join(dir, 'media', file))],
    )
    images += rowCount
  }
} finally {
  await client.end()
}

console.log(`Imported ${posts} posts and ${images} images from ${dir}.`)
