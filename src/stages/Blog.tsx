import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowUpRight } from 'lucide-react'
import { BLOG } from '../content/copy'
import { asset } from '../lib/asset'
import { audio } from '../lib/audio'
import { pushRipple, scroll } from '../lib/scrollState'
import { useStageTailFade } from '../hooks/useStageTailFade'

gsap.registerPlugin(ScrollTrigger)

/** Shape of blog/latest.json, written by blog/src/pages/latest.json.ts. */
type LatestPost = {
  title: string
  description: string
  date: string
  author: string | null
  url: string
  cover: string | null
  excerpt: string
}

// In dev the blog runs on its own Astro server (`npm run dev` starts both);
// in a build it sits next to the portfolio at <base>/blog/.
const BLOG_ROOT = import.meta.env.DEV ? 'http://localhost:4321/blog/' : asset('blog/')
const fromBlog = (path: string) => new URL(path, new URL(BLOG_ROOT, window.location.href)).href

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * Stage 5. A preview of the newest blog post, pulled from the Astro blog's
 * build output. The card is always in the DOM so the scrubbed timeline has
 * something to animate while the JSON is still on its way.
 */
export function Blog() {
  const root = useRef<HTMLElement>(null)
  useStageTailFade('blog')
  // undefined while loading, null when there is nothing to show
  const [latest, setLatest] = useState<LatestPost | null | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    fetch(fromBlog('latest.json'), { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<LatestPost | null>) : null))
      .then((post) => setLatest(post))
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') setLatest(null)
      })
    return () => controller.abort()
  }, [])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.8,
          },
        })
        .fromTo(
          '[data-blog-card]',
          { autoAlpha: 0, y: 48, rotateX: 12, scale: 0.94 },
          { autoAlpha: 1, y: 0, rotateX: 0, scale: 1, duration: 1.6, ease: 'power3.out' },
          0,
        )
        .fromTo(
          '[data-blog-cta]',
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' },
          1.1,
        )
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
    <section id="stage-blog" ref={root} className="stage" style={{ height: '240svh' }} aria-label={BLOG.label}>
      <div className="stage__pin flex items-center" style={{ perspective: '1400px' }}>
        <div className="shell relative z-10 w-full" data-stage-body>
          <div className="mb-6 flex items-baseline gap-3 md:mb-10 md:gap-4">
            <span className="eyebrow">{BLOG.label}</span>
            <h2 className="display text-[clamp(1.35rem,4vw,2.6rem)] text-white/85">{BLOG.heading}</h2>
          </div>

          <article
            data-blog-card
            className="pointer-events-auto grid gap-6 rounded-3xl border border-white/12 bg-white/[0.045] p-5 backdrop-blur-xl transition-colors duration-500 hover:border-white/25 hover:bg-white/[0.075] md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-8 md:p-8"
            style={{ visibility: 'hidden' }}
            onPointerMove={ripple}
            onPointerEnter={hover}
            onPointerLeave={unhover}
          >
            {latest?.cover && (
              <img
                src={fromBlog(latest.cover)}
                alt=""
                loading="lazy"
                className="aspect-[16/10] w-full rounded-2xl object-cover md:aspect-auto md:h-full"
              />
            )}
            <div className={latest?.cover ? 'min-w-0' : 'min-w-0 md:col-span-2'}>
              {latest ? (
                <>
                  <p className="text-sm text-white/45">
                    <time dateTime={latest.date}>{formatDate(latest.date)}</time>
                    {latest.author && <span> · {latest.author}</span>}
                  </p>
                  <h3 className="display grad-text mt-1.5 text-[clamp(1.5rem,3.6vw,2.4rem)]">{latest.title}</h3>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-white/70 md:text-[1.02rem]">
                    {latest.excerpt || latest.description}
                  </p>
                  <a
                    href={fromBlog(latest.url)}
                    className="link mt-5 inline-flex items-center gap-1.5 text-sm text-white/80"
                    onClick={() => audio.play('click')}
                  >
                    {BLOG.readCta}
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </a>
                </>
              ) : (
                <p className="text-[0.95rem] leading-relaxed text-white/55">
                  {latest === null ? BLOG.empty : ' '}
                </p>
              )}
            </div>
          </article>

          <div data-blog-cta className="mt-6 md:mt-8" style={{ visibility: 'hidden' }}>
            <a
              href={BLOG_ROOT}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#14091f] transition-transform duration-500 hover:scale-[1.035] active:scale-[0.98]"
              onClick={() => audio.play('click')}
            >
              {BLOG.cta}
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
