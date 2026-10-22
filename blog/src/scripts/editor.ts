import { marked } from 'marked'
import { parsePost, serializePost, validateMeta } from '../lib/frontmatter'
import type { PostMeta } from '../lib/frontmatter'
import { sound } from './sound'

/**
 * The blog editor at /blog/write/.
 *
 * Talks to the blog's own API (src/pages/api). The server checks each staff
 * member's username and password and keeps the session in an HttpOnly
 * cookie, so nothing secret ever lives in this script or in browser storage.
 */

type ImageUpload = { name: string; base64: string }

const API = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}api/`

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function api<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const write = method !== 'GET'
  const res = await fetch(`${API}${path}`, {
    method,
    // Every write is JSON, even a bodyless DELETE: Astro's own origin check
    // treats a write without a JSON content type as a form post and blocks it.
    headers: write ? { 'Content-Type': 'application/json' } : undefined,
    body: write ? JSON.stringify(body ?? {}) : undefined,
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `The server said ${res.status}.`, res.status)
  return data as T
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const today = () => new Date().toISOString().slice(0, 10)

export function startEditor() {
  const status = byId<HTMLParagraphElement>('status')
  const login = byId<HTMLFormElement>('login')
  const workspace = byId<HTMLDivElement>('workspace')
  const postList = byId<HTMLDivElement>('post-list')
  const form = byId<HTMLFormElement>('post-form')
  const title = byId<HTMLInputElement>('post-title')
  const slug = byId<HTMLInputElement>('post-slug')
  const description = byId<HTMLInputElement>('post-description')
  const date = byId<HTMLInputElement>('post-date')
  const cover = byId<HTMLInputElement>('post-cover')
  const coverCurrent = byId<HTMLParagraphElement>('cover-current')
  const draft = byId<HTMLInputElement>('post-draft')
  const body = byId<HTMLTextAreaElement>('post-body')
  const preview = byId<HTMLDivElement>('preview')
  const deleteButton = byId<HTMLButtonElement>('delete-post')

  let knownSlugs: string[] = []
  /** slug of the post being edited, null for a new post */
  let editing: string | null = null
  let existingCover: string | undefined
  let slugTouched = false

  const signedInAs = byId<HTMLSpanElement>('signed-in-as')

  const say = (message: string, tone: 'info' | 'error' = 'info') => {
    status.textContent = message
    status.className = `mb-6 min-h-6 text-sm ${tone === 'error' ? 'text-red-300' : 'text-white/70'}`
    if (tone === 'error') sound.play('error')
  }

  const show = (view: 'login' | 'workspace' | 'none') => {
    login.hidden = view !== 'login'
    workspace.hidden = view !== 'workspace'
  }

  /** Runs an action with every button disabled, reporting any failure. */
  const busy = async (message: string, action: () => Promise<void>) => {
    const buttons = document.querySelectorAll<HTMLButtonElement>('button')
    buttons.forEach((b) => (b.disabled = true))
    say(message)
    try {
      await action()
    } catch (error) {
      // an expired session drops back to the sign-in form
      if (error instanceof ApiError && error.status === 401) show('login')
      say(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      buttons.forEach((b) => (b.disabled = false))
    }
  }

  // Only the signed-in author sees this preview of their own writing, so
  // rendering marked's HTML directly is acceptable here.
  const renderPreview = () => {
    preview.innerHTML = marked.parse(body.value || '*Nothing written yet.*', { async: false })
  }

  const fillForm = (post: (PostMeta & { slug: string; body: string }) | null) => {
    editing = post?.slug ?? null
    existingCover = post?.cover
    slugTouched = Boolean(post)
    title.value = post?.title ?? ''
    slug.value = post?.slug ?? ''
    slug.readOnly = Boolean(post)
    description.value = post?.description ?? ''
    date.value = post?.date || today()
    draft.checked = post?.draft ?? false
    body.value = post?.body ?? ''
    cover.value = ''
    coverCurrent.textContent = existingCover ? `Current cover: ${existingCover}` : ''
    deleteButton.hidden = !post
    renderPreview()
  }

  const refreshList = async () => {
    knownSlugs = await api<string[]>('posts')
    postList.replaceChildren(
      ...knownSlugs.map((s) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = s
        button.className = `rounded-full border px-3 py-1 text-sm transition-colors ${
          s === editing ? 'border-[#f7a1c6]/60 text-white' : 'border-white/12 text-white/65 hover:text-white'
        }`
        button.addEventListener('click', () =>
          busy(`Opening ${s}…`, async () => {
            const { content } = await api<{ content: string }>(`posts/${s}`)
            const { meta, body: markdown } = parsePost(content)
            fillForm({ ...meta, slug: s, body: markdown })
            await refreshList()
            say(`Editing ${s}.`)
          }),
        )
        return button
      }),
    )
    if (knownSlugs.length === 0) postList.textContent = 'No posts yet.'
  }

  const openWorkspace = async (name: string) => {
    show('workspace')
    signedInAs.textContent = `Signed in as ${name}`
    fillForm(null)
    await refreshList()
    say(`Hi ${name}. Pick a post to edit, or start a new one.`)
  }

  login.addEventListener('submit', (event) => {
    event.preventDefault()
    const username = byId<HTMLInputElement>('login-username')
    const password = byId<HTMLInputElement>('login-password')
    void busy('Signing in…', async () => {
      const { name } = await api<{ name: string }>('session', 'POST', {
        username: username.value,
        password: password.value,
      })
      password.value = ''
      sound.play('open')
      await openWorkspace(name)
    })
  })

  byId('sign-out').addEventListener('click', () =>
    busy('Signing out…', async () => {
      await api('session', 'DELETE')
      fillForm(null)
      show('login')
      sound.play('close')
      say('Signed out.')
    }),
  )

  title.addEventListener('input', () => {
    if (!slugTouched) slug.value = slugify(title.value)
  })
  slug.addEventListener('input', () => {
    slugTouched = true
  })
  body.addEventListener('input', renderPreview)

  byId('new-post').addEventListener('click', () => {
    fillForm(null)
    void busy('New post.', refreshList).then(() => say('New post.'))
  })

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const target = editing ?? slug.value
    if (!editing && knownSlugs.includes(target)) {
      return say(`A post called ${target} already exists. Open it to edit, or change the address.`, 'error')
    }

    void busy('Publishing…', async () => {
      let image: ImageUpload | undefined
      let coverPath = existingCover
      const file = cover.files?.[0]
      if (file) {
        if (file.size > 8 * 1024 * 1024) throw new Error('Images must be under 8 MB.')
        const ext = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const name = `${target}-${Date.now().toString(36)}.${['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png'}`
        image = { name, base64: bytesToBase64(new Uint8Array(await file.arrayBuffer())) }
        coverPath = `media/${name}`
      }

      const meta: PostMeta = {
        title: title.value.trim(),
        description: description.value.trim(),
        date: date.value,
        cover: coverPath,
        draft: draft.checked,
      }
      const problem = validateMeta(meta)
      if (problem) throw new Error(problem)

      await api(`posts/${target}`, 'PUT', { content: serializePost(meta, body.value), image })
      fillForm({ ...meta, slug: target, body: body.value })
      await refreshList()
      sound.play('success')
      say(draft.checked ? `Saved ${target} as a draft.` : `Published ${target}. It is live now.`)
    })
  })

  deleteButton.addEventListener('click', () => {
    if (!editing) return
    const target = editing
    if (!window.confirm(`Delete "${target}"? This removes it from the site.`)) return
    void busy('Deleting…', async () => {
      await api(`posts/${target}`, 'DELETE')
      fillForm(null)
      await refreshList()
      sound.play('close')
      say(`Deleted ${target}.`)
    })
  })

  show('none')
  void busy('Checking…', async () => {
    const session = await api<{ configured: boolean; signedIn: boolean; name: string | null }>('session')
    if (!session.configured) {
      say('The editor is locked: there are no staff accounts yet. Run `npm run staff -- add <username>` on the server.', 'error')
      return
    }
    if (session.signedIn) await openWorkspace(session.name ?? 'there')
    else {
      show('login')
      say('')
    }
  })
}
