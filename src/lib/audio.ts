import { Howl, Howler } from 'howler'
import { asset } from './asset'

const STORAGE_KEY = 'ruby:muted'

type Sfx = 'click' | 'hover' | 'transition'

/**
 * Small wrapper over Howler.
 *
 * Autoplay policy means nothing can play until the visitor interacts, so the
 * sounds are built lazily on the first gesture. Mute state lives in
 * localStorage so it survives reloads.
 */
class AudioEngine {
  private ambient: Howl | null = null
  private ambientId: number | null = null
  private sfx: Partial<Record<Sfx, Howl>> = {}
  private started = false
  private built = false
  private wasPlayingBeforeSuspend = false

  muted: boolean

  constructor() {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      stored = null
    }
    // Silent until asked for. A first-time visitor gets sound, never noise.
    this.muted = stored === null ? true : stored === 'true'

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.suspend()
        else this.resume()
      })
    }
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
    this.ambient = new Howl({
      src: [asset('/audio/ambient.wav')],
      loop: true,
      volume: 0.32,
      html5: false,
    })
    this.sfx.click = new Howl({ src: [asset('/audio/click.wav')], volume: 0.5 })
    this.sfx.hover = new Howl({ src: [asset('/audio/hover.wav')], volume: 0.28 })
    this.sfx.transition = new Howl({ src: [asset('/audio/transition.wav')], volume: 0.34 })
    if (!this.muted) this.playAmbient()
  }

  playAmbient() {
    if (!this.ambient || this.muted) return
    // Track the one ambient sound by id. A bare play() while the file is still
    // loading queues a brand new sound each call, because playing() reads
    // false until load, so unmuting before the WAV arrived stacked two loops.
    if (this.ambientId === null) this.ambientId = this.ambient.play()
    else if (!this.ambient.playing(this.ambientId)) this.ambient.play(this.ambientId)
    this.started = true
  }

  setMuted(muted: boolean) {
    this.muted = muted
    this.persist()
    if (muted) {
      this.ambient?.pause()
      Howler.mute(false)
      this.wasPlayingBeforeSuspend = false
      return
    }
    this.unlock()
    this.playAmbient()
  }

  toggle() {
    this.setMuted(!this.muted)
    return this.muted
  }

  play(kind: Sfx) {
    if (this.muted) return
    const sound = this.sfx[kind]
    if (!sound) return
    // Replaying a Howl that is still ringing restarts it, which is the
    // right feel for rapid hover runs.
    if (sound.playing()) sound.stop()
    sound.play()
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

export const audio = new AudioEngine()

type Sub = (muted: boolean) => void
const subs = new Set<Sub>()

/** Toggle UI subscribes here so it does not need to be inside the engine. */
export function subscribeAudio(fn: Sub) {
  subs.add(fn)
  fn(audio.muted)
  return () => {
    subs.delete(fn)
  }
}

export function setMuted(muted: boolean) {
  audio.setMuted(muted)
  subs.forEach((fn) => fn(muted))
}

export function toggleAudio() {
  return setMuted(!audio.muted)
}