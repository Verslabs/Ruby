-- The blog's tables. Every statement is idempotent: the blog runs this file
-- on its first database call, and so do the scripts in scripts/.

CREATE TABLE IF NOT EXISTS staff (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  display_name text NOT NULL,
  -- scrypt:N:r:p:salt:hash, salt and hash in base64
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only a SHA-256 of each session token is stored, so a leaked table cannot
-- be used to sign in.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  staff_id integer NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS posts (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  date date NOT NULL,
  -- path under the blog, e.g. media/cover-abc.jpg
  cover text,
  draft boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  -- who first wrote it; kept as null if that staff account is removed
  author_id integer REFERENCES staff (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_published ON posts (date DESC) WHERE NOT draft;

-- Images uploaded through the editor.
CREATE TABLE IF NOT EXISTS media (
  name text PRIMARY KEY,
  content_type text NOT NULL,
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
