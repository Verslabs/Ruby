import type { APIRoute } from 'astro'
import {
  clearFailures,
  clientKey,
  currentStaff,
  endSession,
  json,
  lockedFor,
  recordFailure,
  sameOrigin,
  staffConfigured,
  startSession,
  USERNAME,
  verifyLogin,
} from '../../lib/auth'

/** Is there a staff account yet, and who is this browser signed in as? */
export const GET: APIRoute = async (context) => {
  const staff = await currentStaff(context)
  return json({ configured: await staffConfigured(), signedIn: Boolean(staff), name: staff?.name ?? null })
}

/** Sign in. */
export const POST: APIRoute = async (context) => {
  if (!(await staffConfigured())) return json({ error: 'No staff accounts exist yet.' }, 503)
  if (!sameOrigin(context.request)) return json({ error: 'Request blocked.' }, 403)

  const key = clientKey(context)
  const wait = lockedFor(key)
  if (wait > 0) {
    return json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minutes.` }, 429)
  }

  const body = (await context.request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const staff =
    USERNAME.test(username) && password && password.length <= 1024 ? await verifyLogin(username, password) : null
  if (!staff) {
    recordFailure(key)
    return json({ error: 'Wrong username or password.' }, 401)
  }

  clearFailures(key)
  await startSession(context, staff)
  return json({ ok: true, name: staff.name })
}

/** Sign out. */
export const DELETE: APIRoute = async (context) => {
  if (!sameOrigin(context.request)) return json({ error: 'Request blocked.' }, 403)
  await endSession(context)
  return json({ ok: true })
}
