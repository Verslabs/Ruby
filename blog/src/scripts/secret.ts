/**
 * A keyboard shortcut to the editor.
 *
 * Typing this sequence anywhere on a blog page (outside a text field) opens
 * the editor, alongside the Staff link in the footer. It is only a shortcut:
 * the editor itself is locked behind each staff member's own sign-in.
 */
const SEQUENCE = 'write!'

let typed = ''

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null
  if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
  if (event.key.length !== 1) return

  typed = (typed + event.key).slice(-SEQUENCE.length)
  if (typed === SEQUENCE) window.location.href = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}write/`
})
