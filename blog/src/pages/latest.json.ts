import type { APIRoute } from 'astro'
import { excerpt, postUrl, publishedPosts } from '../lib/posts'
import { blogUrl } from '../lib/urls'

/**
 * The newest post, for the Blog stage on the portfolio page
 * (src/stages/Blog.tsx). `null` when nothing is published.
 */
export const GET: APIRoute = async () => {
  const [post] = await publishedPosts()
  const latest = post
    ? {
        title: post.title,
        description: post.description,
        date: post.date.toISOString(),
        author: post.author,
        url: postUrl(post),
        cover: post.cover ? blogUrl(post.cover) : null,
        excerpt: excerpt(post.body),
      }
    : null

  return new Response(JSON.stringify(latest), {
    // always fresh, so a deleted or edited post never lingers in the preview
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
  })
}
