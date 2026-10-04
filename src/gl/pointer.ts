import type { ThreeEvent } from '@react-three/fiber'

/**
 * R3F attaches `setPointerCapture` / `releasePointerCapture` to the synthetic
 * event's `target`, but the published type for `target` is still the DOM
 * `EventTarget`, so the capability has to be narrowed by hand.
 */
type CapturableTarget = {
  setPointerCapture?: (pointerId: number) => void
  releasePointerCapture?: (pointerId: number) => void
}

/**
 * Captures the pointer on the dragged object so move events keep arriving
 * after the cursor leaves the mesh. Without this a fast throw drops the
 * object as soon as it leaves the ray.
 */
export function capturePointer(e: ThreeEvent<PointerEvent>) {
  const target = e.target as unknown as CapturableTarget | null
  target?.setPointerCapture?.(e.pointerId)
}

export function releasePointer(e: ThreeEvent<PointerEvent>) {
  const target = e.target as unknown as CapturableTarget | null
  target?.releasePointerCapture?.(e.pointerId)
}

/** Screen position of a pointer event, normalised to 0..1 of the canvas. */
export function normalizedCanvasPoint(e: ThreeEvent<PointerEvent>, el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / rect.width,
    y: (e.clientY - rect.top) / rect.height,
  }
}
