import type { APIRoute } from 'astro'
import { guard, json } from '../../../lib/auth'
import { allSlugs } from '../../../lib/posts'

/** Every post, drafts included, for the editor's list. */
export const GET: APIRoute = async (context) => {
  const staff = await guard(context)
  return staff instanceof Response ? staff : json(await allSlugs())
}
