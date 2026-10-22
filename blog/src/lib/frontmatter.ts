/**
 * Post files: a small front matter block, then Markdown.
 *
 * Shared by the server (reading and validating posts) and the editor
 * (writing them), so both always agree on the format. Values are written as
 * JSON strings, which are also valid YAML, so any title survives the trip.
 */

export type PostMeta = {
  title: string
  description: string
  /** YYYY-MM-DD */
  date: string
  /** path under the blog, e.g. media/cover-abc.jpg */
  cover?: string
  draft: boolean
}

export function parsePost(text: string): { meta: PostMeta; body: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  const fields: Record<string, string> = {}
  for (const line of (match?.[1] ?? '').split(/\r?\n/)) {
    const pair = line.match(/^(\w+):\s*(.*)$/)
    if (!pair) continue
    const value = pair[2].trim()
    try {
      fields[pair[1]] = value.startsWith('"') ? JSON.parse(value) : value.replace(/^'(.*)'$/, '$1')
    } catch {
      fields[pair[1]] = value
    }
  }

  return {
    meta: {
      title: fields.title ?? '',
      description: fields.description ?? '',
      date: (fields.date ?? '').slice(0, 10),
      cover: fields.cover || undefined,
      draft: fields.draft === 'true',
    },
    body: (match?.[2] ?? text).trim(),
  }
}

export function serializePost(meta: PostMeta, body: string): string {
  const lines = [
    `title: ${JSON.stringify(meta.title)}`,
    `description: ${JSON.stringify(meta.description)}`,
    `date: ${meta.date}`,
  ]
  if (meta.cover) lines.push(`cover: ${JSON.stringify(meta.cover)}`)
  if (meta.draft) lines.push('draft: true')
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`
}

/** The fields a post must have before it can be saved. */
export function validateMeta(meta: PostMeta): string | null {
  if (!meta.title.trim()) return 'A post needs a title.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date) || Number.isNaN(Date.parse(meta.date))) return 'A post needs a valid date.'
  if (meta.cover && !/^media\/[a-z0-9][a-z0-9-]*\.(png|jpe?g|webp|gif)$/.test(meta.cover)) return 'The cover path is not valid.'
  return null
}
