import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowDown } from 'lucide-react'
import { HERO } from '../content/copy'

gsap.registerPlugin(ScrollTrigger)

/**
 * One headline line, split into per-character boxes so it can stagger in.
 *
 * When the line is the gradient one, the characters carry `grad-char` and get
 * their ramp aligned to the line as a whole (see the measure pass below).
 */
function CharLine({ text, grad }: { text: string; grad: boolean }) {
  return (
    <span data-line className="block overflow-hidden pb-[0.08em]">
      {Array.from(text).map((char, i) => (
        <span
          key={i}
          className={`hero-char inline-block will-change-transform ${grad ? 'grad-char' : ''}`}
        >
          {/* a non-breaking space keeps words from collapsing, since every
              character is its own inline-block box */}
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  )
}

export function Hero() {
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    // Align each gradient character's ramp to its line. Runs on mount and
    // again on resize, because the line width depends on the fluid type size.
    const alignGradient = () => {
      root.current?.querySelectorAll<HTMLElement>('[data-line]').forEach((line) => {
        line.style.setProperty('--grad-w', `${line.offsetWidth}px`)
        line.querySelectorAll<HTMLElement>('.grad-char').forEach((char) => {
          char.style.setProperty('--cx', `${char.offsetLeft - line.offsetLeft}px`)
        })
      })
    }
    alignGradient()
    // the first pass measures the fallback font; Bricolage arrives later with
    // different glyph widths, which would leave the ramp misaligned
    document.fonts?.ready.then(alignGradient)
    window.addEventListener('resize', alignGradient)

    const ctx = gsap.context(() => {
      const chars = gsap.utils.toArray<HTMLElement>('.hero-char')

      // entrance: characters rise out of their own line boxes
      gsap.from(chars, {
        yPercent: 118,
        rotateX: -68,
        opacity: 0,
        duration: 0.95,
        ease: 'expo.out',
        stagger: 0.016,
        delay: 0.15,
      })

      gsap.from('[data-hero-fade]', {
        y: 22,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.09,
        delay: 0.55,
      })

      // the hint keeps drifting after the entrance has finished
      gsap.to('[data-hero-hint]', {
        y: 7,
        repeat: -1,
        yoyo: true,
        duration: 1.5,
        ease: 'sine.inOut',
      })

      // scrubbed exit: the headline pulls away as the first stage runs out
      gsap
        .timeline({
          scrollTrigger: {
            trigger: '#stage-hero',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.7,
          },
        })
        .to('[data-hero-block]', { yPercent: -18, opacity: 0.2, ease: 'none' }, 0)
        .to('[data-hero-block]', { scale: 0.88, ease: 'none' }, 0)
        .to('[data-hero-block]', { yPercent: 12, opacity: 0, ease: 'none' }, 0.62)
    }, root)

    return () => {
      window.removeEventListener('resize', alignGradient)
      ctx.revert()
    }
  }, [])

  return (
    <section
      id="stage-hero"
      ref={root}
      className="stage"
      style={{ height: '180svh' }}
      aria-label="Intro"
    >
      <div className="stage__pin flex items-center">
        <div className="shell relative z-10 w-full">
          <div data-hero-block>
            <p className="eyebrow mb-6" data-hero-fade>
              {HERO.eyebrow}
            </p>

            <h1
              className="display text-[clamp(2.2rem,6.9vw,6rem)]"
              data-hero-fade
              style={{ perspective: '900px' }}
            >
              {HERO.headline.map((line, i) => (
                <CharLine key={i} text={line.text} grad={line.grad} />
              ))}
            </h1>

            <div className="mt-9 flex max-w-xl flex-col gap-4">
              <p className="text-[0.98rem] leading-relaxed text-white/70" data-hero-fade>
                {HERO.sub}
              </p>
              <p className="text-sm leading-relaxed text-white/45" data-hero-fade>
                {HERO.grabHint}
              </p>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-8 z-10 flex flex-col items-center gap-2"
          data-hero-hint
        >
          <span className="eyebrow text-white/45">{HERO.scrollHint}</span>
          <ArrowDown className="h-4 w-4 text-white/50" strokeWidth={1.5} />
        </div>
      </div>
    </section>
  )
}
