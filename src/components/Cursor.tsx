import { useEffect, useRef } from 'react'
import { isTouchDevice, scroll } from '../lib/scrollState'
import { asset } from '../lib/asset'

/**
 * Mesh cursor.
 *
 * A spring, not a lerp: the blob is pulled toward the pointer with a
 * stiffness/damper pair, so it lags and overshoots like something with mass.
 * It swells over anything interactive and tucks in while dragging.
 *
 * Runs on its own rAF and writes transforms directly, so it never re-renders
 * React. Touch devices keep the native cursor and never mount this.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isTouchDevice()) return

    const el = ref.current
    if (!el) return
    document.documentElement.dataset.meshCursor = 'on'

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let vx = 0
    let vy = 0
    let tx = x
    let ty = y
    let scale = 0.4
    let scaleV = 0
    let scaleTarget = 0.4
    let opacity = 0
    let raf = 0

    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
      if (opacity < 1) opacity = 1
      scroll.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      scroll.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
      scroll.pointerPx.x = e.clientX
      scroll.pointerPx.y = e.clientY
      scroll.pointerInside = true

      if (scroll.dragging) scaleTarget = 0.62
      else if (scroll.hovering) scaleTarget = 1.55
      else scaleTarget = 0.95
    }

    const onOver = () => {
      scroll.pointerInside = true
    }
    const onLeave = () => {
      scroll.pointerInside = false
      scaleTarget = 0.4
    }
    const onDown = () => {
      if (scroll.dragging) scaleTarget = 0.62
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('pointerdown', onDown, { passive: true })

    const STIFF = 0.16
    const DAMP = 0.74
    const SCALE_STIFF = 0.2
    const SCALE_DAMP = 0.68

    const tick = () => {
      vx += (tx - x) * STIFF
      vy += (ty - y) * STIFF
      vx *= DAMP
      vy *= DAMP
      x += vx
      y += vy

      scaleV += (scaleTarget - scale) * SCALE_STIFF
      scaleV *= SCALE_DAMP
      scale += scaleV

      const wantOpacity = scroll.pointerInside ? 1 : 0
      opacity += (wantOpacity - opacity) * 0.12

      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`
      el.style.opacity = String(opacity)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointerdown', onDown)
      delete document.documentElement.dataset.meshCursor
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[90] opacity-0 mix-blend-screen"
      style={{ width: 44, height: 44, willChange: 'transform, opacity' }}
    >
      <img
        src={asset('/assets/vectors/cursor.png')}
        alt=""
        width={44}
        height={44}
        className="h-full w-full select-none"
        draggable={false}
      />
    </div>
  )
}
