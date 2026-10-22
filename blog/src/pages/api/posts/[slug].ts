import type { APIRoute } from 'astro'
import { guard, json } from '../../../lib/auth'
import { parsePost, validateMeta } from '../../../lib/frontmatter'
import { deletePost, MEDIA_NAME, readRawPost, SLUG, writeMedia, writeRawPost } from '../../../lib/posts'

const MAX_POST_CHARS = 1_000_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** The raw Markdown of one post, for editing. */
export const GET: APIRoute = async (context) => {
  const staff = await guard(context)
  if (staff instanceof Response) return staff
  const slug = context.params.slug ?? ''
  if (!SLUG.test(slug)) return json({ error: 'Bad post address.' }, 400)
  const content = await readRawPost(slug)
  return content === null ? json({ error: 'That post no longer exists.' }, 404) : json({ content })
}

/** Create or replace a post, with an optional cover image. */
export const PUT: APIRoute = async (context) => {
  const staff = await guard(context, { write: true })
  if (staff instanceof Response) return staff
  const slug = context.params.slug ?? ''
  if (!SLUG.test(slug)) return json({ error: 'Bad post address.' }, 400)

  const body = (await context.request.json().catch(() => null)) as {
    content?: unknown
    image?: { name?: unknown; base64?: unknown }
  } | null
  const content = typeof body?.content === 'string' ? body.content : ''
  if (!content || content.length > MAX_POST_CHARS) return json({ error: 'The post is empty or too long.' }, 400)

  const problem = validateMeta(parsePost(content).meta)
  if (problem) return json({ error: problem }, 400)

  if (body?.image) {
    const { name, base64 } = body.image
    if (typeof name !== 'string' || !MEDIA_NAME.test(name) || typeof base64 !== 'string') {
      return json({ error: 'That image could not be read.' }, 400)
    }
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return json({ error: 'Images must be under 8 MB.' }, 400)
    await writeMedia(name, bytes)
  }

  await writeRawPost(slug, content, staff.id)
  return json({ ok: true })
}

export const DELETE: APIRoute = async (context) => {
  const staff = await guard(context, { write: true })
  if (staff instanceof Response) return staff
  const slug = context.params.slug ?? ''
  if (!SLUG.test(slug)) return json({ error: 'Bad post address.' }, 400)
  await deletePost(slug)
  return json({ ok: true })
}
