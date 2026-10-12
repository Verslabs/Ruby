import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { STAGE_ORDER } from '../lib/stageRanges'
import { measureStageRanges } from '../lib/stageRanges'
import { audio } from '../lib/audio'
import { prefersReducedMotion, scroll, setStage } from '../lib/scrollState'

gsap.registerPlugin(ScrollTrigger)

let lenisInstance: Lenis | null = null

/**
 * Smooth scrolling plus the scroll bookkeeping every other module reads.
 *
 * Lenis keeps real scroll position (so anchors, focus and the accessibility
 * tree still work) and only interpolates the frame to it. ScrollTrigger is
 * driven from Lenis's scroll event rather than the native one, which keeps
 * pinned timelines and the smooth position in agreement.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const reduced = prefersReducedMotion()

    const lenis = new Lenis(
      reduced
        ? { lerp: 1, smoothWheel: false, syncTouch: false }
        : {
            duration: 1.05,
            easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.7,
          },
    )
    lenisInstance = lenis

    // exposed so the nav can reuse the same easing instead of fighting it
    window.__rubyScrollTo = (target: number) => lenis.scrollTo(target, { duration: 1.15 })

    let rawVelocity = 0

    lenis.on('scroll', ScrollTrigger.update)

    const triggers: ScrollTrigger[] = []

    triggers.push(ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        scroll.progress = self.progress
        rawVelocity = self.getVelocity()
      },
    }))

    STAGE_ORDER.forEach((id) => {
      const el = document.getElementById(`stage-${id}`)
      if (!el) return
      triggers.push(ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          scroll.stageProgress = self.progress
        },
        onToggle: (self) => {
          if (!self.isActive) return
          setStage(id)
          audio.unlock()
          audio.play('transition')
        },
      }))
    })

    const tick = (time: number) => {
      lenis.raf(time * 1000)
      // px/s -> roughly -1..1, then smoothed so a trackpad flick does not snap
      const target = Math.max(-1, Math.min(1, rawVelocity / 2600))
      scroll.velocity += (target - scroll.velocity) * 0.12
      rawVelocity *= 0.86
    }
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const measure = () => {
      measureStageRanges()
      ScrollTrigger.refresh()
    }
    // run after layout has settled, and again whenever the size changes
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('load', measure)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', measure)
      gsap.ticker.remove(tick)
      // without this a remount (StrictMode does one in dev) leaves the old
      // triggers alive, so every stage change fires twice
      triggers.forEach((t) => t.kill())
      lenis.destroy()
      lenisInstance = null
      delete window.__rubyScrollTo
    }
  }, [])
}

export function scrollTo(target: number) {
  lenisInstance?.scrollTo(target, { duration: 1.15 })
}
