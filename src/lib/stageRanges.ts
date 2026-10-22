import type { StageId } from '../content/copy'
import { scroll } from './scrollState'

export const STAGE_ORDER: StageId[] = ['hero', 'about', 'stack', 'experience', 'blog', 'contact']

type Range = [number, number]

const ranges: Partial<Record<StageId, Range>> = {}

/**
 * Measures where each stage sits in document scroll, as a 0..1 fraction of
 * the scrollable distance.
 *
 * The 3D layer uses these to fade groups in and out. Measuring the DOM keeps
 * the ranges correct no matter what the section heights end up being, which
 * a hand-tuned table would not survive.
 */
export function measureStageRanges() {
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - window.innerHeight
  if (scrollable <= 0) return

  STAGE_ORDER.forEach((id, i) => {
    const el = document.getElementById(`stage-${id}`)
    if (!el) return
    const nextId = STAGE_ORDER[i + 1]
    const next = nextId ? document.getElementById(`stage-${nextId}`) : null
    // rect + scrollY works even if an ancestor ever becomes the offset parent
    const top = el.getBoundingClientRect().top + window.scrollY
    const bottom = next ? next.getBoundingClientRect().top + window.scrollY : doc.scrollHeight
    ranges[id] = [top / scrollable, Math.min(1, bottom / scrollable)]
  })
}

const smoothstep = (a: number, b: number, x: number) => {
  if (a === b) return x < a ? 0 : 1
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const FADE = 0.035

/**
 * How present a stage is right now, 0..1. Stages overlap slightly so the
 * hand-off between them never shows an empty frame.
 */
export function weightFor(id: StageId): number {
  const range = ranges[id]
  if (!range) return 0
  const [a, b] = range
  const p = scroll.progress
  // the first stage starts at exactly 0, so it must be allowed through here
  if (p < a || p >= b) return 0
  const fadeIn = a === 0 ? 1 : smoothstep(a, a + FADE, p)
  const fadeOut = 1 - smoothstep(b - FADE, b, p)
  return fadeIn * fadeOut
}

/** 0..1 position inside a stage's range, for driving sub-animations. */
export function localProgress(id: StageId): number {
  const range = ranges[id]
  if (!range) return 0
  const [a, b] = range
  return b > a ? Math.min(1, Math.max(0, (scroll.progress - a) / (b - a))) : 0
}
