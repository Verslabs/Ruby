// Staff accounts for the blog editor.
//
//   npm run staff -- add <username> [display name]
//   npm run staff -- password <username>
//   npm run staff -- remove <username>
//   npm run staff -- list
//
// Passwords are asked for twice without echoing, and only their scrypt hash
// is stored. Removing an account signs it out everywhere; its posts stay up,
// just without a byline.
import { randomBytes, scrypt } from 'node:crypto'
import { argv, stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline'
import { connect } from './db.mjs'

const SCRYPT = { N: 16384, r: 8, p: 1 }
const MIN_LENGTH = 10
const USERNAME = /^[a-z0-9][a-z0-9_-]{1,31}$/

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true })
    // print the prompt, swallow the typed characters
    rl._writeToOutput = (text) => {
      if (text.includes(question)) stdout.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      stdout.write('\n')
      resolve(answer)
    })
  })
}

async function askPassword() {
  const password = await askHidden('Password: ')
  if (password.length < MIN_LENGTH) fail(`Use at least ${MIN_LENGTH} characters.`)
  if ((await askHidden('Type it again: ')) !== password) fail('The passwords do not match.')
  const salt = randomBytes(16)
  const hash = await new Promise((resolve, reject) =>
    scrypt(password, salt, 64, SCRYPT, (error, key) => (error ? reject(error) : resolve(key))),
  )
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString('base64')}:${hash.toString('base64')}`
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const [command, rawUsername, ...rest] = argv.slice(2)
const username = rawUsername?.toLowerCase()
const needsUser = ['add', 'password', 'remove'].includes(command)
if (needsUser && !USERNAME.test(username ?? '')) {
  fail('Usernames are 2 to 32 characters: lowercase letters, numbers, - and _.')
}

const client = await connect()
try {
  if (command === 'add') {
    const name = rest.join(' ').trim() || rawUsername
    const exists = await client.query('SELECT 1 FROM staff WHERE username = $1', [username])
    if (exists.rowCount) fail(`${username} already has an account.`)
    const hash = await askPassword()
    await client.query('INSERT INTO staff (username, display_name, password_hash) VALUES ($1, $2, $3)', [
      username,
      name,
      hash,
    ])
    console.log(`Added ${username} (shown on posts as "${name}").`)
  } else if (command === 'password') {
    const exists = await client.query('SELECT 1 FROM staff WHERE username = $1', [username])
    if (!exists.rowCount) fail(`No account called ${username}.`)
    const hash = await askPassword()
    await client.query(
      `WITH s AS (UPDATE staff SET password_hash = $2 WHERE username = $1 RETURNING id)
       DELETE FROM sessions WHERE staff_id IN (SELECT id FROM s)`,
      [username, hash],
    )
    console.log(`Changed the password for ${username} and signed them out everywhere.`)
  } else if (command === 'remove') {
    const { rowCount } = await client.query('DELETE FROM staff WHERE username = $1', [username])
    if (!rowCount) fail(`No account called ${username}.`)
    console.log(`Removed ${username}.`)
  } else if (command === 'list') {
    const { rows } = await client.query(
      `SELECT s.username, s.display_name, count(p.slug)::int AS posts
       FROM staff s LEFT JOIN posts p ON p.author_id = s.id
       GROUP BY s.id ORDER BY s.username`,
    )
    if (rows.length === 0) console.log('No staff accounts yet. Add one with: npm run staff -- add <username>')
    for (const row of rows) console.log(`${row.username}\t${row.display_name}\t${row.posts} posts`)
  } else {
    fail('Usage: npm run staff -- add <username> [display name] | password <username> | remove <username> | list')
  }
} finally {
  await client.end()
}
