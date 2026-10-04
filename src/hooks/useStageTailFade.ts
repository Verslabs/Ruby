import { useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Crossfades the hand-off between consecutive pinned stages.
 *
 * A `position: sticky` stage has one viewport of scroll left after its pin
 * travel runs out, and that window is exactly the one the next stage spends
 * rising into place. Left alone, the outgoing copy gets sliced by the top of
 * the viewport while the incoming copy slides up underneath it.
 *
 * So the outgoing stage dissolves across its tail and the incoming one
 * materialises across the same stretch of scroll, which is a clean exchange
 * rather than two half-visible screens stacked on top of each other.
 */
export function useStageTailFade(stageId: string, selector = '[data-stage-body]') {
  useLayoutEffect(() => {
    const el = document.getElementById(`stage-${stageId}`)
    if (!el) return

    const ctx = gsap.context(() => {
      // rising into place
      gsap.fromTo(
        selector,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'top top', scrub: true },
        },
      )

      // and dissolving once the pin travel is spent
      gsap.to(selector, {
        opacity: 0,
        ease: 'none',
        immediateRender: false,
        scrollTrigger: { trigger: el, start: 'bottom bottom', end: 'bottom top', scrub: true },
      })
    })

    return () => ctx.revert()
  }, [stageId, selector])
}
