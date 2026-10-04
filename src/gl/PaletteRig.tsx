import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, DirectionalLight, HemisphereLight } from 'three'
import { samplePalettes } from '../lib/palettes'
import { scroll } from '../lib/scrollState'

const tmp = new Color()
let lastBgHex = ''

/**
 * Scroll-linked palette engine.
 *
 * Samples the five-palette ramp every frame and writes the result to the
 * scene background and the three lights. It also publishes the interpolated
 * background to `--stage-bg` so the DOM can match the WebGL canvas, throttled
 * so we are not writing a custom property on every single frame.
 */
export function PaletteRig() {
  const scene = useThree((s) => s.scene)
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)

  useEffect(() => {
    if (!scene.background) scene.background = tmp.set(samplePalettes(0).bgHex)
    return () => {
      scene.background = null
    }
  }, [scene])

  useFrame(() => {
    const palette = samplePalettes(scroll.progress)

    if (scene.background instanceof Color) scene.background.copy(palette.bg)

    if (key.current) {
      key.current.color.lerp(palette.key, 0.12)
      key.current.intensity = 3.1 + Math.abs(scroll.velocity) * 1.4
      // swing the key light toward the pointer for a moving specular highlight
      key.current.position.x += (scroll.pointer.x * 4 - key.current.position.x) * 0.05
      key.current.position.y += (scroll.pointer.y * 3 + 4.2 - key.current.position.y) * 0.05
    }
    if (rim.current) {
      rim.current.color.lerp(palette.rim, 0.12)
      rim.current.intensity = 2.6
      rim.current.position.x += (-scroll.pointer.x * 3 - 4.5 - rim.current.position.x) * 0.05
    }
    if (hemi.current) {
      hemi.current.color.lerp(palette.ribbonA, 0.12)
      hemi.current.groundColor.lerp(palette.bg, 0.12)
    }

    // only touch the DOM when the colour has actually moved
    if (palette.bgHex !== lastBgHex) {
      lastBgHex = palette.bgHex
      document.documentElement.style.setProperty('--stage-bg', palette.bgHex)
    }
  })

  return (
    <>
      <hemisphereLight ref={hemi} intensity={0.55} />
      {/* key and rim drift with the cursor so the highlights move with you */}
      <directionalLight ref={key} position={[3.4, 4.2, 5.5]} intensity={3.1} />
      <directionalLight ref={rim} position={[-4.5, -2.4, 2.6]} intensity={2.6} />
      {/* a soft fill from below keeps the undersides from going flat black */}
      <pointLight position={[0, -4, -2]} intensity={18} distance={16} />
    </>
  )
}