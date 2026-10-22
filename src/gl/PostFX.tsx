import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { Vector2, Vector4 } from 'three'
import { liquidDistortionShader } from '../shaders/liquidDistortion'
import { scroll } from '../lib/scrollState'

const MAX_RIPPLES = 6

/**
 * Owns rendering for the whole canvas.
 *
 * Any useFrame with priority > 0 takes over the render loop in R3F, so this
 * component renders the scene through an EffectComposer instead of letting
 * the canvas draw directly. The liquid pass samples the finished frame and
 * offsets its UVs.
 */
export function PostFX() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  // the Viewport lowers dpr under load, so the composer targets must follow it
  const dpr = useThree((s) => s.viewport.dpr)

  const { composer, liquid } = useMemo(() => {
    const c = new EffectComposer(gl)
    c.addPass(new RenderPass(scene, camera))

    const pass = new ShaderPass(liquidDistortionShader)
    pass.uniforms.uPointer.value = new Vector2(0.5, 0.5)
    pass.uniforms.uAspect.value = 1
    pass.uniforms.uRipples.value = Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -99, 0))

    c.addPass(pass)
    c.addPass(new OutputPass())
    return { composer: c, liquid: pass }
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(Math.min(dpr, 2))
    composer.setSize(size.width, size.height)
    liquid.uniforms.uAspect.value = size.height > 0 ? size.width / size.height : 1
  }, [composer, liquid, size, dpr])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame((_, delta) => {
    const u = liquid.uniforms
    u.uTime.value = scroll.clock
    u.uEnergy.value += (Math.abs(scroll.velocity) - u.uEnergy.value) * Math.min(1, delta * 6)

    const pointer = u.uPointer.value as Vector2
    pointer.set((scroll.pointer.x + 1) * 0.5, (scroll.pointer.y + 1) * 0.5)

    // The store shifts as new ripples arrive, so always pack from the front
    // rather than matching indices, or a live ripple would inherit a dead slot.
    const ripples = u.uRipples.value as Vector4[]
    for (let i = 0; i < MAX_RIPPLES; i++) ripples[i].w = 0
    for (let i = 0; i < Math.min(MAX_RIPPLES, scroll.ripples.length); i++) {
      const r = scroll.ripples[i]
      if (scroll.clock - r.t < 2.2) {
        // the shader works bottom-up, the ripple store is top-down
        ripples[i].set(r.x, 1 - r.y, r.t, 1)
      }
    }

    composer.render(delta)
  }, 1)

  return null
}