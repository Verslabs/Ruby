import { Howl, Howler } from 'howler'

/**
 * The sound engine, shared by the portfolio (src/lib/audio.ts) and the blog
 * (blog/src/scripts/sound.ts). The files themselves are made by
 * scripts/make-audio.mjs.
 *
 * Autoplay policy means nothing can play until the visitor interacts, so the
 * sounds are built lazily on the first gesture. Mute state lives in
 * localStorage under one key, so the portfolio and the blog share it, and a
 * change in one tab carries to the others.
 *
 * Each one-shot is nudged a little in pitch and level every time it plays and
 * panned towards wherever the pointer is, so a run of hovers sounds like
 * touching real things instead of a sample on repeat.
 */

export type Sfx = 'click' | 'hover' | 'transition' | 'open' | 'close' | 'pop' | 'success' | 'error'

const SFX: Record<Sfx, { volume: number; jitter: number }> = {
  click: { volume: 0.42, jitter: 0.04 },
  hover: { volume: 0.12, jitter: 0.07 },
  transition: { volume: 0.3, jitter: 0.03 },
  open: { volume: 0.3, jitter: 0.02 },
  close: { volume: 0.24, jitter: 0.02 },
  pop: { volume: 0.42, jitter: 0.03 },
  success: { volume: 0.36, jitter: 0 },
  error: { volume: 0.3, jitter: 0 },
}

const STORAGE_KEY = 'ruby:muted'
const AMBIENT_VOLUME = 0.26
const AMBIENT_FADE_IN_MS = 1800
const AMBIENT_FADE_OUT_MS = 450
// a pointer sweeping across a list should not machine-gun the hover sound
const HOVER_GAP_MS = 55
// how far towards the edge the pointer can pan a sound (1 = hard left/right)
const PAN_WIDTH = 0.55

type Sub = (muted: boolean) => void

export class SoundEngine {
  private ambient: Howl | null = null
  private sfx: Partial<Record<Sfx, Howl>> = {}
  private started = false
  private built = false
  private wasPlayingBeforeSuspend = false
  private lastHover = 0
  private pointerPan = 0
  private subs = new Set<Sub>()

  private readonly url: (file: string) => string
  private readonly withAmbient: boolean

  muted: boolean

  /**
   * @param url resolves a file in public/audio to a URL
   * @param withAmbient whether this page plays the ambient bed
   */
  constructor(url: (file: string) => string, withAmbient: boolean) {
    this.url = url
    this.withAmbient = withAmbient
    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      stored = null
    }
    // Silent until asked for. A first-time visitor gets sound, never noise.
    this.muted = stored === null ? true : stored === 'true'

    window.addEventListener(
      'pointermove',
      (event) => {
        this.pointerPan = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1
      },
      { passive: true },
    )
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue !== null) this.apply(event.newValue === 'true')
    })
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.muted))
    } catch {
      /* private mode, nothing to do */
    }
  }

  /** Safe to call on every gesture; only the first one does work. */
  unlock() {
    if (this.built) return
    this.built = true
    if (this.withAmbient) {
      this.ambient = new Howl({ src: [this.url('audio/ambient.wav')], loop: true, volume: 0, html5: false })
    }
    for (const kind of Object.keys(SFX) as Sfx[]) {
      this.sfx[kind] = new Howl({ src: [this.url(`audio/${kind}.wav`)], volume: SFX[kind].volume })
    }
    if (!this.muted) this.playAmbient()
  }

  playAmbient() {
    if (!this.ambient || this.muted) return
    if (!this.ambient.playing()) {
      this.ambient.volume(0)
      this.ambient.play()
    }
    this.ambient.fade(this.ambient.volume(), AMBIENT_VOLUME, AMBIENT_FADE_IN_MS)
    this.started = true
  }

  /** Mute or unmute here, without touching storage. */
  private apply(muted: boolean) {
    if (muted === this.muted) return
    this.muted = muted
    if (muted) {
      const ambient = this.ambient
      if (ambient?.playing()) {
        ambient.fade(ambient.volume(), 0, AMBIENT_FADE_OUT_MS)
        // unless the visitor turned it back on mid-fade
        ambient.once('fade', () => {
          if (this.muted) ambient.pause()
        })
      }
      Howler.mute(false)
      this.wasPlayingBeforeSuspend = false
    } else {
      this.unlock()
      this.playAmbient()
    }
    this.subs.forEach((fn) => fn(muted))
  }

  setMuted(muted: boolean) {
    this.apply(muted)
    this.persist()
  }

  toggle() {
    this.setMuted(!this.muted)
    return this.muted
  }

  /** Toggle UI subscribes here so it does not need to be inside the engine. */
  subscribe(fn: Sub) {
    this.subs.add(fn)
    fn(this.muted)
    return () => {
      this.subs.delete(fn)
    }
  }

  /** `pan` overrides the pointer position, -1 (left) to 1 (right). */
  play(kind: Sfx, { pan }: { pan?: number } = {}) {
    if (this.muted) return
    const sound = this.sfx[kind]
    if (!sound) return
    if (kind === 'hover') {
      const now = performance.now()
      if (now - this.lastHover < HOVER_GAP_MS) return
      this.lastHover = now
    }
    const { volume, jitter } = SFX[kind]
    const id = sound.play()
    sound.rate(1 + (Math.random() * 2 - 1) * jitter, id)
    sound.volume(volume * (1 - Math.random() * jitter * 2), id)
    sound.stereo(Math.max(-1, Math.min(1, pan ?? this.pointerPan)) * PAN_WIDTH, id)
  }

  /** Called when the tab is hidden so we do not hold the audio graph open. */
  suspend() {
    if (this.started && !this.muted) {
      Howler.mute(true)
      this.wasPlayingBeforeSuspend = true
    }
  }

  resume() {
    if (this.started && !this.muted && this.wasPlayingBeforeSuspend) {
      Howler.mute(false)
    }
  }

  get isPlaying() {
    return this.started && !this.muted
  }
}
