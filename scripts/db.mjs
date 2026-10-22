// Shared by the blog's command-line scripts (staff.mjs, blog-import.mjs).
// They run under `node --env-file-if-exists=blog/.env`, so DATABASE_URL comes
// from the same place the blog reads it in dev.
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const SCHEMA = new URL('../blog/db/schema.sql', import.meta.url)

/** A client with the blog's schema applied. Call `client.end()` when done. */
export async function connect() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Put it in blog/.env, or pass --env-file=/etc/ruby/ruby.env on the VPS.')
    process.exit(1)
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(await readFile(SCHEMA, 'utf8'))
  return client
}
