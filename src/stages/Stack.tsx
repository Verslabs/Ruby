import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { STACK } from '../content/copy'
import { useStageTailFade } from '../hooks/useStageTailFade'

gsap.registerPlugin(ScrollTrigger)

/**
 * Stage 3. The canvas pins and the sine wave ribbons light up behind it. The
 * chips live in the 3D layer (see gl/BadgeChip), so this stage is mostly the
 * column of notes, revealed one at a time as the scrub passes.
 */
export function Stack() {
  const root = useRef<HTMLElement>(null)
  useStageTailFade('stack')

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const rows = gsap.utils.toArray<HTMLElement>('.stack-row')

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
        },
      })

      rows.forEach((row, i) => {
        const at = i * 2
        tl.fromTo(row, { autoAlpha: 0, x: -34 }, { autoAlpha: 1, x: 0, duration: 1, ease: 'power2.out' }, at)
          .to(row, { autoAlpha: 0, x: 34, duration: 1, ease: 'power2.in' }, at + 1)
      })

      const last = rows[rows.length - 1]
      tl.fromTo(
        '[data-stack-note]',
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out' },
        last ? rows.length * 2 - 1 : 0,
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="stage-stack"
      ref={root}
      className="stage"
      style={{ height: `${STACK.entries.length * 62 + 40}svh` }}
      aria-label={STACK.label}
    >
      <div className="stage__pin flex items-center">
        <div className="shell relative z-10 w-full" data-stage-body>
          <div className="mb-9 flex items-baseline gap-4 md:mb-12">
            <span className="eyebrow">{STACK.label}</span>
            <h2 className="display text-[clamp(1.5rem,4vw,2.6rem)] text-white/85">
              {STACK.heading}
            </h2>
          </div>

          <div className="max-w-md">
            <div className="relative min-h-[30svh]">
              {STACK.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="stack-row absolute inset-x-0 top-0"
                  style={{ visibility: 'hidden' }}
                >
                  <div
                    className="mb-3 flex items-center gap-3"
                    style={{ color: entry.color }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="font-display text-[clamp(1.4rem,3.4vw,2.3rem)] font-bold tracking-[-0.02em]">
                      {entry.name}
                    </span>
                  </div>
                  <p className="text-[0.98rem] leading-relaxed text-white/70">{entry.note}</p>
                </div>
              ))}

              <p
                data-stack-note
                className="absolute inset-x-0 top-0 text-[0.98rem] leading-relaxed text-white/50"
                style={{ visibility: 'hidden' }}
              >
                {STACK.note}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
