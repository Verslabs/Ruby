import { SoundEngine } from '../../../src/lib/sound'
import { siteUrl } from '../lib/urls'

/**
 * The blog's sounds: the same engine and files as the portfolio, minus the
 * ambient bed, which would fight with reading. Links and buttons get a hover
 * and a click, and the mute button in the header (Base.astro) shares its
 * setting with the portfolio's.
 */
export const sound = new SoundEngine(siteUrl, false)

const INTERACTIVE = 'a[href], button, summary, label:has(input[type="checkbox"])'

let hovered: Element | null = null

document.addEventListener('pointerover', (event) => {
  // touch has no hover, and a tap already gets the click sound
  if (event.pointerType !== 'mouse') return
  const target = (event.target as Element).closest(INTERACTIVE)
  if (target === hovered) return
  hovered = target
  if (!target || (target as HTMLButtonElement).disabled) return
  sound.unlock()
  sound.play('hover')
})

for (const type of ['pointerdown', 'keydown'] as const) {
  document.addEventListener(type, () => sound.unlock(), { passive: true })
}

document.addEventListener('click', (event) => {
  const target = (event.target as Element).closest(INTERACTIVE)
  // the editor's own buttons answer with success or error instead
  if (!target || target.closest('[data-sound-toggle], [data-sound-quiet]')) return
  sound.play('click')
})

// --- the mute button in the header

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')) {
  button.addEventListener('click', () => {
    sound.unlock()
    sound.toggle()
    sound.play('click')
  })
  sound.subscribe((muted) => {
    button.setAttribute('aria-pressed', String(!muted))
    button.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off')
    button.querySelector<SVGElement>('[data-icon="on"]')?.toggleAttribute('hidden', muted)
    button.querySelector<SVGElement>('[data-icon="off"]')?.toggleAttribute('hidden', !muted)
  })
}
