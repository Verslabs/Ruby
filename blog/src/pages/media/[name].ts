import type { APIRoute } from 'astro'
import { MEDIA_NAME, readMedia } from '../../lib/posts'

/** Images uploaded through the editor, served from the database. */
export const GET: APIRoute = async ({ params }) => {
  const name = params.name ?? ''
  if (!MEDIA_NAME.test(name)) return new Response(null, { status: 404 })
  const media = await readMedia(name)
  if (!media) return new Response(null, { status: 404 })

  return new Response(new Uint8Array(media.bytes), {
    headers: {
      'Content-Type': media.type,
      // every upload gets a fresh name, so a file never changes
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
