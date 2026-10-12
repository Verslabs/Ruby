import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, Mesh, ShaderMaterial } from 'three'
import { waveRibbonsFragment, waveRibbonsVertex } from '../shaders/waveRibbons'
import { scroll } from '../lib/scrollState'
import { samplePalettes } from '../lib/palettes'

type Props = {
  /** returns the 0..1 fade, driven by the stack stage timeline */
  opacity: () => number
}

/**
 * Stage 3 backdrop.
 *
 * A clip-space quad drawn additively behind everything: one full-screen pass
 * and no geometry beyond two triangles. The vertex shader writes clip space
 * directly, so the plane stays 2x2 no matter what the camera is doing.
 */
export function WaveBackdrop({ opacity }: Props) {
  const mesh = useRef<Mesh>(null)

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: waveRibbonsVertex,
        fragmentShader: waveRibbonsFragment,
        uniforms: {
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uScroll: { value: 0 },
          uOpacity: { value: 0 },
          uAspect: { value: 1 },
          uPointer: { value: [0, 0] },
          uColA: { value: new Color('#f7a1c6') },
          uColB: { value: new Color('#52d6f7') },
        },
        transparent: true,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  )

  useFrame((state, delta) => {
    const u = material.uniforms
    const damp = Math.min(1, delta * 5)

    // the shader works in aspect-corrected space, so ribbons and the pointer
    // warp stretch with the viewport unless this tracks the canvas
    u.uAspect.value = state.size.width / Math.max(1, state.size.height)

    u.uTime.value = scroll.clock
    u.uEnergy.value += (Math.abs(scroll.velocity) - u.uEnergy.value) * damp
    u.uScroll.value = scroll.stageProgress
    u.uOpacity.value += (opacity() - u.uOpacity.value) * Math.min(1, delta * 6)

    const palette = samplePalettes(scroll.progress)
    ;(u.uColA.value as Color).copy(palette.ribbonA)
    ;(u.uColB.value as Color).copy(palette.ribbonB)

    const ptr = u.uPointer.value as number[]
    ptr[0] += (scroll.pointer.x - ptr[0]) * damp
    ptr[1] += (scroll.pointer.y - ptr[1]) * damp

    if (mesh.current) mesh.current.visible = u.uOpacity.value > 0.004
  })

  return (
    <mesh ref={mesh} material={material} renderOrder={-1000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}