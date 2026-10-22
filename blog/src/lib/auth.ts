import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { APIContext } from 'astro'
import { db } from './db'

/**
 * Staff login.
 *
 * Each staff member has their own account in the `staff` table, made with
 * `npm run staff -- add <username>`. Only scrypt hashes of passwords are
 * stored. A correct password starts a session: a random token sent back as an
 * HttpOnly, SameSite=Strict cookie, with only its SHA-256 kept in the
 * `sessions` table, so sessions survive a restart. Failed attempts are rate
 * limited per client.
 */

const SESSION_COOKIE = 'blog_session'
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60 * 1000

export const USERNAME = /^[a-z0-9][a-z0-9_-]{1,31}$/

export type Staff = { id: number; username: string; name: string }

const failures = new Map<string, { count: number; resetAt: number }>()

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** False until the first account is made, which keeps the editor locked. */
export async function staffConfigured(): Promise<boolean> {
  const { rows } = await (await db()).query<{ any: boolean }>('SELECT EXISTS (SELECT 1 FROM staff) AS any')
  return rows[0].any
}

function scryptAsync(password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, { ...options, maxmem: 128 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

// Checked against when the username does not exist, so a wrong username takes
// as long as a wrong password and the response time gives nothing away.
const DECOY_HASH = `scrypt:16384:8:1:${randomBytes(16).toString('base64')}:${randomBytes(64).toString('base64')}`

async function verifyHash(password: string, stored: string): Promise<boolean> {
  // scrypt:N:r:p:salt:hash, salt and hash in base64
  const [scheme, N, r, p, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return timingSafeEqual(actual, expected)
}

/** The account these credentials belong to, or null. */
export async function verifyLogin(username: string, password: string): Promise<Staff | null> {
  const { rows } = await (await db()).query<Staff & { password_hash: string }>(
    'SELECT id, username, display_name AS name, password_hash FROM staff WHERE username = $1',
    [username],
  )
  const account = rows[0]
  const ok = await verifyHash(password, account?.password_hash ?? DECOY_HASH)
  return account && ok ? { id: account.id, username: account.username, name: account.name } : null
}

/** Who is asking, for rate limiting. server/index.mjs resolves the proxy hop. */
export function clientKey(context: APIContext): string {
  if (context.locals.clientIp) return context.locals.clientIp
  try {
    return context.clientAddress
  } catch {
    return 'unknown'
  }
}

/** Seconds until this client may try again, or 0. */
export function lockedFor(key: string): number {
  const entry = failures.get(key)
  if (!entry) return 0
  if (entry.resetAt <= Date.now()) {
    failures.delete(key)
    return 0
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 0
}

export function recordFailure(key: string) {
  const entry = failures.get(key)
  if (!entry || entry.resetAt <= Date.now()) failures.set(key, { count: 1, resetAt: Date.now() + LOCKOUT_MS })
  else entry.count += 1
}

export const clearFailures = (key: string) => failures.delete(key)

export async function startSession(context: APIContext, staff: Staff) {
  const token = randomBytes(32).toString('base64url')
  const pool = await db()
  // signing in is rare, so it is a fine moment to sweep out expired sessions
  await pool.query('DELETE FROM sessions WHERE expires_at < now()')
  await pool.query('INSERT INTO sessions (token_hash, staff_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    staff.id,
    new Date(Date.now() + SESSION_TTL_MS),
  ])
  context.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: import.meta.env.PROD,
    path: import.meta.env.BASE_URL,
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function endSession(context: APIContext) {
  const token = context.cookies.get(SESSION_COOKIE)?.value
  if (token) await (await db()).query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
  context.cookies.delete(SESSION_COOKIE, { path: import.meta.env.BASE_URL })
}

/** The signed-in staff member, or null. */
export async function currentStaff(context: APIContext): Promise<Staff | null> {
  const token = context.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const { rows } = await (await db()).query<Staff>(
    `SELECT s.id, s.username, s.display_name AS name
     FROM sessions x JOIN staff s ON s.id = x.staff_id
     WHERE x.token_hash = $1 AND x.expires_at > now()`,
    [hashToken(token)],
  )
  return rows[0] ?? null
}

/**
 * Writes must come from this site's own pages. With the SameSite cookie this
 * shuts out cross-site request forgery.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  })

/**
 * The signed-in staff member, or the response that turns the request away
 * (not signed in, or a cross-site write).
 */
export async function guard(context: APIContext, { write = false } = {}): Promise<Staff | Response> {
  const staff = await currentStaff(context)
  if (!staff) return json({ error: 'Not signed in.' }, 401)
  if (write && !sameOrigin(context.request)) return json({ error: 'Request blocked.' }, 403)
  return staff
}
