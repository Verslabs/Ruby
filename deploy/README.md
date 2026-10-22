# Deploying to a VPS

The whole site is one Node process (`server/index.mjs`): the portfolio as static
files, and the Astro blog at `/blog/` with its editor. A web server in front
(Caddy or nginx) handles HTTPS and forwards everything to it.

Needs **Node 22.22 or newer** on the VPS.

## First time

```bash
# 1. A user and folders for the app
sudo useradd --system --home-dir /var/lib/ruby --shell /usr/sbin/nologin ruby
# (/var/lib/ruby must exist: ruby.service lists it in ReadWritePaths)
sudo mkdir -p /srv/ruby /var/lib/ruby /etc/ruby
sudo chown ruby:ruby /srv/ruby /var/lib/ruby

# 2. PostgreSQL and the blog's database (pick your own password)
sudo apt install postgresql
sudo -u postgres createuser --pwprompt ruby
sudo -u postgres createdb --owner ruby ruby_blog

# 3. The code, built
sudo -u ruby git clone <your repo url> /srv/ruby
cd /srv/ruby
sudo -u ruby npm ci
sudo -u ruby npm run build

# 4. Settings: put the database password into DATABASE_URL
sudo cp deploy/ruby.env.example /etc/ruby/ruby.env
sudoedit /etc/ruby/ruby.env
sudo chown root:ruby /etc/ruby/ruby.env && sudo chmod 640 /etc/ruby/ruby.env

# 5. Staff accounts, and the sample post (optional)
sudo -u ruby node --env-file=/etc/ruby/ruby.env scripts/staff.mjs add ruby "Ruby"
sudo -u ruby node --env-file=/etc/ruby/ruby.env scripts/blog-import.mjs

# 5. Run it
sudo cp deploy/ruby.service /etc/systemd/system/ruby.service
sudo systemctl daemon-reload
sudo systemctl enable --now ruby
curl -I http://127.0.0.1:4000/          # should say 200
```

Then point your web server at it with **either** `deploy/Caddyfile` **or**
`deploy/nginx.conf` (each file has its own steps at the top), after replacing
`example.com` with your domain.

## Updating the code

```bash
cd /srv/ruby
sudo -u ruby git pull
sudo -u ruby npm ci
sudo -u ruby npm run build
sudo systemctl restart ruby
```

Posts live in PostgreSQL, so updates never touch them. Back the database up:

```bash
sudo -u postgres pg_dump ruby_blog > ruby_blog-$(date +%F).sql
```

## Writing posts

Go to `https://<your domain>/blog/write/` (the **Staff** link in the blog's
footer, or type `write!` on any blog page) and sign in with your own staff
account. Posts go live the moment you publish, credited to whoever wrote them.

Manage staff from `/srv/ruby` (prefix each with
`sudo -u ruby node --env-file=/etc/ruby/ruby.env`):

- `scripts/staff.mjs add <username> "Display Name"` adds someone.
- `scripts/staff.mjs password <username>` changes a password and signs them out.
- `scripts/staff.mjs remove <username>` removes an account; its posts stay up.
- `scripts/staff.mjs list` shows everyone and how many posts each has.

Five wrong passwords lock that address out for 15 minutes. Sessions last 12
hours and survive restarts.

## Logs

```bash
journalctl -u ruby -f
```
