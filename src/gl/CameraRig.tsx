import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { scroll } from '../lib/scrollState'
import { localProgress, STAGE_ORDER, weightFor } from '../lib/stageRanges'

const target = new Vector3()
const desired = new Vector3()

/** One camera vantage per stage, blended together by their weights. */
const STAGE_VANTAGES = {
  hero: new Vector3(0, 0.2, 9.4),
  about: new Vector3(-1.6, -0.5, 8.0),
  stack: new Vector3(0.9, 0.6, 7.4),
  experience: new Vector3(-0.8, -0.9, 8.8),
  contact: new Vector3(0, 0.9, 9.0),
}

/**
 * Camera moves across the whole page rather than jumping between stages.
 *
 * Each stage pulls the camera to its own vantage, the weights crossfade
 * between those vantages, and the pointer adds a little parallax on top.
 * Scroll velocity adds a short shake that decays immediately.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const shake = useRef(0)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const speed = Math.abs(scroll.velocity)

    desired.set(0, 0, 9)
    let total = 0
    for (const id of STAGE_ORDER) {
      const w = weightFor(id)
      if (w <= 0) continue
      total += w
      desired.addScaledVector(STAGE_VANTAGES[id], w)
    }
    if (total > 0) desired.multiplyScalar(1 / total)

    // hero pulls back as its headline reveals
    desired.z += localProgress('hero') * 2.6
    // the stack stage leans in so the ribbons fill more of the frame
    desired.z -= localProgress('stack') * 1.2

    // pointer parallax
    desired.x += scroll.pointer.x * 0.85
    desired.y += scroll.pointer.y * 0.55

    // fast scrolling nudges the camera, then it settles
    shake.current = Math.max(shake.current, speed * 0.35)
    shake.current *= Math.max(0, 1 - 3.5 * delta)
    desired.x += Math.sin(scroll.clock * 21) * shake.current
    desired.y += Math.cos(scroll.clock * 17) * shake.current

    camera.position.lerp(desired, Math.min(1, delta * 3.2))

    // look slightly ahead of where the content sits
    target.set(scroll.pointer.x * 0.25, scroll.pointer.y * 0.18, 0)
    camera.lookAt(target)
  })

  return null
}
