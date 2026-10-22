# Instructions for Claude Code on the VPS

Paste everything below the line into Claude Code running as root on the VPS
(109.230.233.90). It deploys the Ruby portfolio and blog to
https://ruby.verslabs.net.

---

You are setting up a website on this server. Work through the steps in order,
check each one worked before moving on, and stop and ask me before doing
anything that could break something already running here.

## What is being deployed

- Repo: https://github.com/Verslabs/Ruby.git (branch `main`)
- One Node.js process (`server/index.mjs`) serves a static portfolio and an
  Astro blog at `/blog/`, listening on 127.0.0.1:4000.
- The blog stores posts, images, staff accounts and sessions in PostgreSQL.
  Its tables are created automatically on first use (`blog/db/schema.sql`).
- nginx in front handles the domain `ruby.verslabs.net` and HTTPS. The DNS A
  record already points at this server.
- `deploy/README.md` in the repo is the reference guide; the steps below follow
  it with the real domain filled in.

## Ground rules

- **Look before you change.** Before step 1, report: OS version, whether node,
  npm, git, psql, nginx, certbot are installed (with versions), what is
  listening on ports 80, 443, 4000 and 5432 (`ss -ltnp`), the contents of
  `/etc/nginx/sites-enabled/`, and whether `/srv/ruby` or a `ruby` user
  already exist.
- If an nginx site already serves `ruby.verslabs.net`, if something is already
  on port 4000, if `/srv/ruby` already exists, or if a `ruby_blog` database
  already exists: **stop and tell me what you found** before touching it. Never
  delete existing sites, databases or folders without my explicit yes.
- Don't change the SSH configuration or the firewall's SSH rule.
- Never print the database password or any staff password back to me.
- Do not set `NODE_ENV=production` before building; the build needs the dev
  dependencies that `npm ci` installs.

## Steps

### 1. Packages

Node must be **22.22 or newer**. If it is missing or older:

```bash
apt update
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

Then make sure these are installed: `git postgresql nginx certbot python3-certbot-nginx`.

### 2. App user and folders

```bash
useradd --system --home-dir /var/lib/ruby --shell /usr/sbin/nologin ruby
mkdir -p /srv/ruby /var/lib/ruby /etc/ruby
chown ruby:ruby /srv/ruby /var/lib/ruby
```

`/var/lib/ruby` must exist: `deploy/ruby.service` lists it in `ReadWritePaths`
and the service will not start without it.

### 3. Database

Generate a random password (letters and digits only, so it needs no escaping
in a URL) and keep it in a shell variable, not on screen:

```bash
DB_PASS=$(openssl rand -hex 24)
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ruby LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres createdb --owner ruby ruby_blog
```

### 4. Code

```bash
sudo -u ruby git clone https://github.com/Verslabs/Ruby.git /srv/ruby
cd /srv/ruby
sudo -u ruby npm ci
sudo -u ruby npm run build
```

If the clone asks for credentials, the repo is private: stop and ask me for a
GitHub access token, or for another way to get the code.

Check the build produced `dist/site/index.html` and
`dist/blog/server/entry.mjs`.

### 5. Settings file

Write `/etc/ruby/ruby.env` from `deploy/ruby.env.example`, filling in the
generated password:

```bash
sed "s|postgres://ruby:CHANGE_ME@|postgres://ruby:${DB_PASS}@|" deploy/ruby.env.example > /etc/ruby/ruby.env
chown root:ruby /etc/ruby/ruby.env
chmod 640 /etc/ruby/ruby.env
unset DB_PASS
```

Confirm `grep -c CHANGE_ME /etc/ruby/ruby.env` prints `0`.

### 6. Sample post (optional, safe to run twice)

```bash
cd /srv/ruby
sudo -u ruby node --env-file=/etc/ruby/ruby.env scripts/blog-import.mjs
```

### 7. Start the service

```bash
cp /srv/ruby/deploy/ruby.service /etc/systemd/system/ruby.service
systemctl daemon-reload
systemctl enable --now ruby
sleep 2
curl -sI http://127.0.0.1:4000/ | head -1
curl -sI http://127.0.0.1:4000/blog/ | head -1
curl -s http://127.0.0.1:4000/blog/api/session
```

Both `curl -I` lines should be `200`, and the last should print JSON with
`"configured":false` (no staff accounts yet). If not, read
`journalctl -u ruby -n 50 --no-pager` and fix the cause.

### 8. nginx for ruby.verslabs.net

```bash
sed 's/server_name example.com www.example.com;/server_name ruby.verslabs.net;/' \
  /srv/ruby/deploy/nginx.conf > /etc/nginx/sites-available/ruby
ln -sf /etc/nginx/sites-available/ruby /etc/nginx/sites-enabled/ruby
nginx -t && systemctl reload nginx
curl -sI -H 'Host: ruby.verslabs.net' http://127.0.0.1/ | head -1
```

If `ufw` is active, allow web traffic: `ufw allow 'Nginx Full'`.

### 9. HTTPS

Staff sign-in only works over HTTPS (the session cookie is marked Secure).
Ask me for an email address for certificate expiry notices, then:

```bash
certbot --nginx -d ruby.verslabs.net --redirect --agree-tos -m <email> -n
```

### 10. My staff account

The password prompt is interactive and hidden, so **I run this one myself**.
Tell me to type exactly this into your prompt (the leading `!` runs it in this
session):

```
! cd /srv/ruby && sudo -u ruby node --env-file=/etc/ruby/ruby.env scripts/staff.mjs add ruby "Ruby"
```

Then confirm it worked with
`sudo -u ruby node --env-file=/etc/ruby/ruby.env scripts/staff.mjs list`.

### 11. Final checks

```bash
curl -sI https://ruby.verslabs.net/ | head -1
curl -sI https://ruby.verslabs.net/blog/ | head -1
curl -sI http://ruby.verslabs.net/ | head -3        # should redirect to https
curl -s https://ruby.verslabs.net/blog/api/session  # "configured":true
systemctl is-enabled ruby && systemctl is-active ruby
```

Then report back: what you installed, anything you found already running and
how you handled it, the results of these checks, and anything that failed.
Tell me to sign in at https://ruby.verslabs.net/blog/write/ with username
`ruby`.

## Updating later

```bash
cd /srv/ruby
sudo -u ruby git pull
sudo -u ruby npm ci
sudo -u ruby npm run build
systemctl restart ruby
```

Posts and accounts live in the database, so updates never touch them. Back it
up with `sudo -u postgres pg_dump ruby_blog > ruby_blog-$(date +%F).sql`.
