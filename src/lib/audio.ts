import { asset } from './asset'
import { SoundEngine } from './sound'

export type { Sfx } from './sound'

/** The portfolio's sounds, ambient bed included. See ./sound.ts. */
export const audio = new SoundEngine(asset, true)

/** Toggle UI subscribes here so it does not need to be inside the engine. */
export const subscribeAudio = (fn: (muted: boolean) => void) => audio.subscribe(fn)

export const setMuted = (muted: boolean) => audio.setMuted(muted)

export const toggleAudio = () => audio.toggle()
