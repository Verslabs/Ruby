import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight } from 'lucide-react'
import { GithubMark } from '../components/GithubMark'
import { EXPERIENCE } from '../content/copy'
import { audio } from '../lib/audio'
import { pushRipple, scroll } from '../lib/scrollState'
import { useStageTailFade } from '../hooks/useStageTailFade'

gsap.registerPlugin(ScrollTrigger)

/**
 * Stage 4. Scroll scrubs the cards from folded and tilted into place, then
 * tilts them back out again. Hovering a card pushes a ripple into the liquid
 * pass, so the whole frame reacts.
 */
export function Experience() {
  const root = useRef<HTMLElement>(null)
  useStageTailFade('experience')

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.xp-card')
      const repos = gsap.utils.toArray<HTMLElement>('.xp-repo')

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#stage-experience',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
        },
      })

      cards.forEach((card, i) => {
        const at = i * 2.2
        tl.fromTo(
          card,
          { autoAlpha: 0, rotateY: -34, rotateX: 14, z: -300, scale: 0.86 },
          { autoAlpha: 1, rotateY: 0, rotateX: 0, z: 0, scale: 1, duration: 1.6, ease: 'power3.out' },
          at,
        )
      })

      const afterCards = cards.length * 2.2
      // The repos block is the last thing to arrive, so its height animates in
      // too. Left collapsed at full height it would push the whole column past
      // a short viewport from the start, and the cards would sit under the nav.
      tl.fromTo(
        '[data-xp-repos]',
        { autoAlpha: 0, height: 0, marginTop: 0, overflow: 'hidden' },
        {
          autoAlpha: 1,
          height: 'auto',
          marginTop: window.innerWidth < 768 ? 32 : 48,
          duration: 1.1,
          ease: 'power2.out',
        },
        afterCards + 0.6,
      )

      repos.forEach((repo, i) => {
        tl.fromTo(
          repo,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' },
          afterCards + 0.8 + i * 0.35,
        )
      })
    }, root)

    return () => ctx.revert()
  }, [])

  const ripple = (e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    pushRipple((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
  }

  const hover = () => {
    scroll.hovering = true
    audio.unlock()
    audio.play('hover')
  }

  const unhover = () => {
    scroll.hovering = false
  }

  return (
    <section
      id="stage-experience"
      ref={root}
      className="stage"
      style={{ height: '380svh' }}
      aria-label={EXPERIENCE.label}
    >
      <div className="stage__pin flex items-center" style={{ perspective: '1400px' }}>
        <div className="shell relative z-10 w-full" data-stage-body>
          <div className="mb-6 flex items-baseline gap-3 md:mb-12 md:gap-4">
            <span className="eyebrow">{EXPERIENCE.label}</span>
            <h2 className="display text-[clamp(1.35rem,4vw,2.6rem)] text-white/85">
              {EXPERIENCE.heading}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-5">
            {EXPERIENCE.roles.map((role) => (
              <article
                key={role.id}
                className="xp-card pointer-events-auto rounded-3xl border border-white/12 bg-white/[0.045] p-5 backdrop-blur-xl transition-colors duration-500 hover:border-white/25 hover:bg-white/[0.075] md:p-7"
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                onPointerMove={ripple}
                onPointerEnter={hover}
                onPointerLeave={unhover}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="display grad-text text-[clamp(1.3rem,3.2vw,2.1rem)]">
                      {role.org}
                    </h3>
                    <p className="mt-1 text-sm font-medium text-white/55">{role.role}</p>
                  </div>
                  {role.href && (
                    <a
                      href={role.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="pointer-events-auto shrink-0 rounded-full border border-white/15 p-2 text-white/70 transition-colors hover:border-white/40 hover:text-white"
                      aria-label={role.linkLabel}
                      onClick={() => audio.play('click')}
                    >
                      <ArrowUpRight className="h-4 w-4" strokeWidth={1.6} />
                    </a>
                  )}
                </div>

                <p className="mt-4 text-[0.88rem] leading-relaxed text-white/70 md:mt-5 md:text-[0.95rem]">
                  {role.body}
                </p>

                {role.href && (
                  <a
                    href={role.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link mt-4 inline-flex items-center gap-2 text-sm text-white/80 md:mt-6"
                    onClick={() => audio.play('click')}
                  >
                    <GithubMark />
                    {role.linkLabel}
                  </a>
                )}
              </article>
            ))}
          </div>

          <div data-xp-repos style={{ height: 0, overflow: 'hidden' }}>
            <p className="eyebrow mb-4 md:mb-5">{EXPERIENCE.reposLabel}</p>
            <div className="grid gap-4 md:grid-cols-2 md:gap-5">
              {EXPERIENCE.repos.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="xp-repo group pointer-events-auto block rounded-3xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-xl transition-colors duration-500 hover:border-white/25 hover:bg-white/[0.075] md:p-7"
                  onPointerMove={ripple}
                  onPointerEnter={hover}
                  onPointerLeave={unhover}
                  onClick={() => audio.play('click')}
                >
                  <div className="flex items-center gap-2.5">
                    <GithubMark className="h-4 w-4 text-white/60" />
                    <span className="font-display text-base font-bold tracking-tight text-white/90 md:text-lg">
                      {repo.handle}
                    </span>
                    <ArrowUpRight
                      className="ml-auto h-4 w-4 text-white/40 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      strokeWidth={1.6}
                    />
                  </div>
                  <p className="mt-2.5 text-[0.88rem] leading-relaxed text-white/65 md:mt-3 md:text-[0.95rem]">
                    {repo.note}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
