import pg from 'pg'
import { DATABASE_URL } from 'astro:env/server'
import schema from '../../db/schema.sql?raw'

/**
 * One connection pool for the whole process. The schema is applied on first
 * use, so a fresh database needs no separate setup step.
 */

// Postgres `date` columns come back as their YYYY-MM-DD text. The default
// parser builds a Date at local midnight, which shifts days across time zones.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value)

let pool: pg.Pool | null = null
let ready: Promise<void> | null = null

export async function db(): Promise<pg.Pool> {
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. See deploy/ruby.env.example.')
  pool ??= new pg.Pool({ connectionString: DATABASE_URL, max: 10 })
  // retried on the next call if the database was not reachable
  ready ??= pool.query(schema).then(
    () => undefined,
    (error: unknown) => {
      ready = null
      throw error
    },
  )
  await ready
  return pool
}
