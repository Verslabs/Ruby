import { useEffect, useRef, useState } from 'react'
import { STAGE_LABELS } from '../content/copy'
import type { StageId } from '../content/copy'
import { getStage, scroll, scrollToStage, subscribeStage } from '../lib/scrollState'
import { STAGE_ORDER } from '../lib/stageRanges'

/**
 * Film grain over the whole frame. An inline SVG turbulence tile keeps it a
 * single composited layer with no image request, and the animation is a
 * stepped translate so it flickers rather than slides.
 */
export function Grain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] opacity-[0.15] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
        animation: 'ruby-grain 0.7s steps(4) infinite',
      }}
    >
      <style>{`@keyframes ruby-grain {
        0%   { transform: translate3d(0, 0, 0); }
        25%  { transform: translate3d(-3%, 2%, 0); }
        50%  { transform: translate3d(2%, -3%, 0); }
        75%  { transform: translate3d(-2%, -2%, 0); }
        100% { transform: translate3d(0, 0, 0); }
      }`}</style>
    </div>
  )
}

/** Thin progress line across the top, tied to document scroll. */
export function ScrollProgress() {
  const fill = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (fill.current) fill.current.style.transform = `scaleX(${scroll.progress})`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px]">
      <span className="block h-full w-full bg-white/10" />
      <span
        ref={fill}
        className="absolute inset-0 block h-full w-full origin-left"
        style={{
          transform: 'scaleX(0)',
          transformOrigin: 'left',
          backgroundImage: 'linear-gradient(to right, #F7A1C6, #C3A5D8, #90BFE6, #52D6F7)',
        }}
      />
    </div>
  )
}

/** Scroll rail on the right edge. Clicking a label jumps to that stage. */
export function StageRail() {
  const [stage, setStage] = useState<StageId>(getStage())

  useEffect(() => {
    const unsubscribe = subscribeStage(setStage)
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <nav
      aria-label="Stages"
      className="pointer-events-none fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 md:block"
    >
      <ul className="flex flex-col items-end gap-3.5">
        {STAGE_ORDER.map((id) => {
          const active = stage === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => scrollToStage(id)}
                aria-current={active ? 'true' : undefined}
                className="pointer-events-auto group flex items-center justify-end gap-2.5"
              >
                <span
                  className={`text-[0.68rem] uppercase tracking-[0.16em] transition-all duration-500 ${
                    active ? 'text-white/80 opacity-100' : 'text-white/45 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {STAGE_LABELS[id]}
                </span>
                <span
                  className={`block rounded-full transition-all duration-500 ${
                    active
                      ? 'h-5 w-[2px] bg-white/85'
                      : 'h-1.5 w-[2px] bg-white/30 group-hover:bg-white/60'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
