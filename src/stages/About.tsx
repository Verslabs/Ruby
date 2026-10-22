import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ABOUT } from '../content/copy'
import { useStageTailFade } from '../hooks/useStageTailFade'

gsap.registerPlugin(ScrollTrigger)

/**
 * One step of the about sequence. Each word is its own box so the line can
 * assemble word by word when the scrub reaches it.
 */
function StepLine({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <p
      className="about-step absolute inset-x-0 top-0 max-w-4xl text-[clamp(1.35rem,4.1vw,3.1rem)] font-medium leading-[1.16] tracking-[-0.02em] text-white/90"
      style={{ visibility: 'hidden' }}
    >
      {words.map((word, j) => (
        <span key={j} className="inline-block overflow-hidden align-bottom">
          <span className="about-word inline-block">
            {word}
            {j < words.length - 1 ? '\u00A0' : ''}
          </span>
        </span>
      ))}
    </p>
  )
}

/**
 * Stage 2. The viewport pins completely and each scroll step plays one line
 * of copy. Nothing moves the page frame, so the 3D shapes behind it keep
 * their own camera move running uninterrupted.
 */
export function About() {
  const root = useRef<HTMLElement>(null)
  useStageTailFade('about')

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const steps = gsap.utils.toArray<HTMLElement>('.about-step')

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.75,
        },
      })

      steps.forEach((step, i) => {
        const at = i * 2
        tl.fromTo(
          step,
          { autoAlpha: 0, y: 46 },
          { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out' },
          at,
        )
          .to(step, { autoAlpha: 0, y: -46, duration: 1, ease: 'power2.in' }, at + 1)
          // each word inside a step lifts on its own, so the line assembles
          .fromTo(
            step.querySelectorAll('.about-word'),
            { yPercent: 108 },
            { yPercent: 0, duration: 0.85, ease: 'expo.out', stagger: 0.03 },
            at,
          )
      })

      const last = steps[steps.length - 1]
      tl.fromTo(
        '[data-about-exit]',
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out' },
        last ? steps.length * 2 - 1 : 0,
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section
      id="stage-about"
      ref={root}
      className="stage"
      style={{ height: `${ABOUT.steps.length * 62 + 40}svh` }}
      aria-label={ABOUT.label}
    >
      <div className="stage__pin flex items-center">
        <div className="shell relative z-10 w-full" data-stage-body>
          <div className="mb-8 flex items-baseline gap-4 md:mb-12">
            <span className="eyebrow">{ABOUT.label}</span>
            <h2 className="display text-[clamp(1.5rem,4vw,2.6rem)] text-white/85">
              {ABOUT.heading}
            </h2>
          </div>

          <div className="relative min-h-[38svh] md:min-h-[32svh]">
            {ABOUT.steps.map((step, i) => (
              <StepLine key={i} text={step} />
            ))}

            <p
              data-about-exit
              className="absolute inset-x-0 top-0 max-w-2xl text-[clamp(1.1rem,2.4vw,1.75rem)] leading-snug text-white/60"
              style={{ visibility: 'hidden' }}
            >
              {ABOUT.exit}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
