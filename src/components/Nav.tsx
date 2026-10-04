import { useEffect, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { NAV } from '../content/copy'
import { audio, subscribeAudio, toggleAudio } from '../lib/audio'
import { scrollToStage, subscribeStage, getStage } from '../lib/scrollState'
import { asset } from '../lib/asset'
import type { StageId } from '../content/copy'

function SoundToggle() {
  const [muted, setMuted] = useState(audio.muted)

  useEffect(() => {
    const unsubscribe = subscribeAudio(setMuted)
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => toggleAudio()}
      className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/75 transition-colors duration-300 hover:border-white/35 hover:text-white"
      aria-label={muted ? NAV.soundOn : NAV.soundOff}
      aria-pressed={!muted}
    >
      {muted ? (
        <VolumeX className="h-4 w-4" strokeWidth={1.6} />
      ) : (
        <Volume2 className="h-4 w-4" strokeWidth={1.6} />
      )}
    </button>
  )
}

type Props = {
  /** opens the contact drawer directly, without scrolling to the stage */
  onOpenContact: () => void
}

export function Nav({ onOpenContact }: Props) {
  const [stage, setStage] = useState<StageId>(getStage())

  useEffect(() => {
    const unsubscribe = subscribeStage(setStage)
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="shell flex items-center justify-between py-5">
        <button
          type="button"
          onClick={() => scrollToStage('hero')}
          className="pointer-events-auto group flex items-center gap-2.5"
          aria-label="Ruby, back to the top"
        >
          <img
            src={asset('/assets/vectors/mark.png')}
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] select-none transition-transform duration-700 group-hover:rotate-[18deg]"
            draggable={false}
          />
          {/* the wordmark is the first thing to go when the bar runs out of
              room on a narrow phone */}
          <span className="hidden font-display text-lg font-bold tracking-tight text-white/90 min-[420px]:inline">
            Ruby
          </span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <nav aria-label={NAV.label}>
            <ul className="flex items-center gap-0 sm:gap-1">
              {NAV.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToStage(item.id as StageId)}
                    aria-current={stage === item.id ? 'true' : undefined}
                    className={`pointer-events-auto rounded-full px-2 py-1.5 text-[0.76rem] transition-colors duration-300 min-[420px]:px-2.5 min-[420px]:text-[0.82rem] sm:px-3 ${
                      stage === item.id
                        ? 'bg-white/12 text-white'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            onClick={() => {
              audio.unlock()
              audio.play('click')
              onOpenContact()
            }}
            className="pointer-events-auto ml-1 hidden rounded-full border border-white/15 px-3.5 py-1.5 text-[0.82rem] text-white/75 transition-colors duration-300 hover:border-white/35 hover:text-white sm:block"
          >
            Say hello
          </button>
          <SoundToggle />
        </div>
      </div>
    </header>
  )
}
