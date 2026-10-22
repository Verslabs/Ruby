import { marked } from 'marked'
import { db } from './db'
import { parsePost, serializePost } from './frontmatter'
import type { PostMeta } from './frontmatter'
import { blogUrl } from './urls'

/**
 * Posts and their images live in PostgreSQL (schema in blog/db/schema.sql)
 * and are read on every request, so whatever the editor saves is live
 * straight away with no rebuild.
 */

export const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/
export const MEDIA_NAME = /^[a-z0-9][a-z0-9-]{0,120}\.(png|jpe?g|webp|gif)$/

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export type Post = Omit<PostMeta, 'date'> & {
  slug: string
  date: Date
  body: string
  /** display name of the staff member who wrote it, if they still have an account */
  author: string | null
}

type PostRow = {
  slug: string
  title: string
  description: string
  date: string
  cover: string | null
  draft: boolean
  body: string
  author: string | null
}

const SELECT_POST = `
  SELECT p.slug, p.title, p.description, p.date, p.cover, p.draft, p.body, s.display_name AS author
  FROM posts p LEFT JOIN staff s ON s.id = p.author_id`

const toPost = (row: PostRow): Post => ({
  ...row,
  cover: row.cover ?? undefined,
  date: new Date(row.date),
})

/** Every post, drafts included, for the editor's list. */
export async function allSlugs(): Promise<string[]> {
  const { rows } = await (await db()).query<{ slug: string }>('SELECT slug FROM posts ORDER BY slug')
  return rows.map((row) => row.slug)
}

/** Published posts, newest first. Drafts never reach a public page. */
export async function publishedPosts(): Promise<Post[]> {
  const { rows } = await (await db()).query<PostRow>(
    `${SELECT_POST} WHERE NOT p.draft ORDER BY p.date DESC, p.created_at DESC`,
  )
  return rows.map(toPost)
}

export async function publishedPost(slug: string): Promise<Post | null> {
  if (!SLUG.test(slug)) return null
  const { rows } = await (await db()).query<PostRow>(`${SELECT_POST} WHERE p.slug = $1 AND NOT p.draft`, [slug])
  return rows[0] ? toPost(rows[0]) : null
}

// Only signed-in staff can write, so their Markdown (including any raw HTML
// in it) is trusted.
export const renderMarkdown = (markdown: string) => marked.parse(markdown, { async: false })

export const postUrl = (post: Post) => blogUrl(`${post.slug}/`)

export const formatDate = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Plain-text opening of a post, for previews. */
export function excerpt(markdown: string, length = 260): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`~]+/g, '')
    .replace(/^\s*>+/gm, ' ')
    .replace(/^\s*-\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text
}

// --- writes, used only by the authenticated editor API

/**
 * One post as front matter plus Markdown, the format the editor works in
 * (see frontmatter.ts).
 */
export async function readRawPost(slug: string): Promise<string | null> {
  const { rows } = await (await db()).query<PostRow>(`${SELECT_POST} WHERE p.slug = $1`, [slug])
  const row = rows[0]
  if (!row) return null
  const { body, ...meta } = row
  return serializePost({ ...meta, cover: meta.cover ?? undefined }, body)
}

/** Create or replace a post. The first author stays credited on later edits. */
export async function writeRawPost(slug: string, markdown: string, authorId: number) {
  const { meta, body } = parsePost(markdown)
  await (await db()).query(
    `INSERT INTO posts (slug, title, description, date, cover, draft, body, author_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       date = EXCLUDED.date,
       cover = EXCLUDED.cover,
       draft = EXCLUDED.draft,
       body = EXCLUDED.body,
       author_id = COALESCE(posts.author_id, EXCLUDED.author_id),
       updated_at = now()`,
    [slug, meta.title, meta.description, meta.date, meta.cover ?? null, meta.draft, body, authorId],
  )
}

export async function deletePost(slug: string) {
  await (await db()).query('DELETE FROM posts WHERE slug = $1', [slug])
}

export async function writeMedia(name: string, bytes: Uint8Array) {
  const type = MEDIA_TYPES[name.split('.').pop()!]
  await (await db()).query(
    `INSERT INTO media (name, content_type, bytes) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes`,
    [name, type, Buffer.from(bytes)],
  )
}

export async function readMedia(name: string): Promise<{ bytes: Buffer; type: string } | null> {
  const { rows } = await (await db()).query<{ bytes: Buffer; content_type: string }>(
    'SELECT bytes, content_type FROM media WHERE name = $1',
    [name],
  )
  return rows[0] ? { bytes: rows[0].bytes, type: rows[0].content_type } : null
}
