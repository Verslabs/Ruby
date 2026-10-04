import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight, Mail, Sparkles } from 'lucide-react'
import { GithubMark } from '../components/GithubMark'
import { CONTACT } from '../content/copy'
import { audio } from '../lib/audio'
import { useStageTailFade } from '../hooks/useStageTailFade'

gsap.registerPlugin(ScrollTrigger)

const GITHUB_LINKS = [
  { handle: 'KitKatsDevelopment', href: 'https://github.com/KitKatsDevelopment' },
  { handle: 'CollaredKittyCat', href: 'https://github.com/CollaredKittyCat' },
  { handle: 'ZenomoStudio', href: 'https://github.com/ZenomoStudio' },
]

type Props = {
  /** parent bumps this to re-fire the 3D particle burst */
  onBurst: () => void
  /** the drawer carries the actual contact details */
  onOpenDrawer: () => void
}

/**
 * Stage 5. Pins on a short timeline, holds the contact details, and fires a
 * particle burst when the visitor actually presses the button.
 */
export function Contact({ onBurst, onOpenDrawer }: Props) {
  const root = useRef<HTMLElement>(null)
  useStageTailFade('contact')

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#stage-contact',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
        },
      })

      tl.fromTo('[data-contact-reveal]', { autoAlpha: 0, y: 38 }, {
        autoAlpha: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.22,
      })
        .fromTo('[data-contact-panel]', { autoAlpha: 0, y: 50, rotateX: -10 }, {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          duration: 1.3,
          ease: 'power3.out',
        }, 0.35)
    }, root)

    return () => ctx.revert()
  }, [])

  const handleBurst = () => {
    audio.unlock()
    audio.play('click')
    onBurst()
    onOpenDrawer()
  }

  return (
    <section
      id="stage-contact"
      ref={root}
      className="stage"
      style={{ height: '280svh' }}
      aria-label={CONTACT.label}
    >
      <div className="stage__pin flex items-center">
        <div className="shell relative z-10 w-full" data-stage-body>
          <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow mb-6" data-contact-reveal>
                {CONTACT.label}
              </p>
              <h2
                className="display text-[clamp(2.5rem,9vw,7rem)]"
                data-contact-reveal
              >
                <span className="grad-text">{CONTACT.heading}</span>
              </h2>
              <p
                className="mt-7 max-w-lg text-[1.02rem] leading-relaxed text-white/70"
                data-contact-reveal
              >
                {CONTACT.body}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4" data-contact-reveal>
                <button
                  type="button"
                  onClick={handleBurst}
                  className="pointer-events-auto group inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[0.95rem] font-semibold text-[#14091f] transition-transform duration-500 hover:scale-[1.035] active:scale-[0.98]"
                  style={{
                    backgroundImage: 'linear-gradient(to right, #F7A1C6, #C3A5D8, #90BFE6, #52D6F7)',
                  }}
                >
                  <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                  {CONTACT.cta}
                </button>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="link pointer-events-auto inline-flex items-center gap-2 text-[0.95rem] text-white/80"
                  onClick={() => audio.play('click')}
                >
                  <Mail className="h-4 w-4" strokeWidth={1.6} />
                  {CONTACT.email}
                </a>
              </div>

              <p className="mt-4 text-sm text-white/45" data-contact-reveal>
                {CONTACT.prompt}
              </p>
            </div>

            <div data-contact-panel style={{ visibility: 'hidden' }}>
              <p className="eyebrow mb-5">{CONTACT.linksLabel}</p>
              <ul className="space-y-2.5">
                {GITHUB_LINKS.map((link) => (
                  <li key={link.handle}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="pointer-events-auto group flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-4 backdrop-blur-xl transition-colors duration-500 hover:border-white/28 hover:bg-white/[0.08]"
                      onClick={() => audio.play('click')}
                    >
                      <GithubMark className="h-4 w-4 shrink-0 text-white/55" />
                      <span className="font-display text-[1.05rem] font-semibold tracking-tight text-white/90">
                        {link.handle}
                      </span>
                      <ArrowUpRight
                        className="ml-auto h-4 w-4 shrink-0 text-white/40 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        strokeWidth={1.6}
                      />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-relaxed text-white/50">
                The open source above is the readable part of the work. The rest
                usually lives in a private repo until it ships.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
