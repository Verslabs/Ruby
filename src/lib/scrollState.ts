import type { StageId } from '../content/copy'

export type Ripple = {
  /** 0..1 across the viewport */
  x: number
  /** 0..1 across the viewport */
  y: number
  /** seconds, taken from the shared clock so the shader and the emitter agree */
  t: number
}

/**
 * Single mutable frame-state object.
 *
 * Everything that animates (the WebGL rig, the shaders, the cursor) reads
 * from here inside useFrame or rAF instead of going through React state.
 * Scroll fires far more often than React is happy to re-render, and this
 * object costs nothing to mutate.
 */
export const scroll = {
  /** 0..1 across the whole document */
  progress: 0,
  /** smoothed scroll speed, roughly -1..1. Drives ribbon amplitude and distortion. */
  velocity: 0,
  /** which stage currently owns the viewport */
  stage: 'hero' as StageId,
  /** 0..1 within the active stage */
  stageProgress: 0,
  /** pointer in NDC, -1..1 */
  pointer: { x: 0, y: 0 },
  /** pointer in CSS pixels */
  pointerPx: { x: 0, y: 0 },
  pointerInside: false,
  /** true while any 3D object is being dragged */
  dragging: false,
  /** true while the pointer is over something clickable */
  hovering: false,
  /** seconds since load, advanced once per frame by the render loop */
  clock: 0,
  ripples: [] as Ripple[],
}

const MAX_RIPPLES = 6

export function pushRipple(x: number, y: number) {
  scroll.ripples.push({ x, y, t: scroll.clock })
  if (scroll.ripples.length > MAX_RIPPLES) scroll.ripples.shift()
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function isTouchDevice() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none), (pointer: coarse)').matches
  )
}

type Listener = (stage: StageId) => void
const listeners = new Set<Listener>()
let currentStage: StageId = 'hero'

/** Called by each stage's ScrollTrigger. Cheap, and only re-renders on change. */
export function setStage(stage: StageId) {
  if (stage === currentStage) return
  currentStage = stage
  scroll.stage = stage
  listeners.forEach((fn) => fn(stage))
}

export function subscribeStage(fn: Listener) {
  listeners.add(fn)
  fn(currentStage)
  return () => listeners.delete(fn)
}

export function getStage() {
  return currentStage
}

/** Maps an id in STAGE_LABELS to its scroll offset in px. */
export const scrollToStage = (id: StageId) => {
  const el = document.getElementById(`stage-${id}`)
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.__rubyScrollTo?.(Math.min(top, max))
}

declare global {
  interface Window {
    /** set by the smooth-scroll bootstrap so nav can reuse the same easing */
    __rubyScrollTo?: (target: number) => void
  }
}