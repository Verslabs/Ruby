import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Group, Material, Plane, Vector3 } from 'three'
import { audio } from '../lib/audio'
import { pushRipple, scroll } from '../lib/scrollState'
import { asset } from '../lib/asset'
import { capturePointer, normalizedCanvasPoint, releasePointer } from './pointer'
import { hash01 } from './phase'

type Props = {
  url: string
  position?: [number, number, number]
  scale?: number
  /** multiplies the idle bob, set 0 for shapes that should hang still */
  drift?: number
  spin?: [number, number, number]
  /** 0 snaps back hard, 1 barely comes home */
  returnStrength?: number
  visible?: () => boolean
}

const tmpNormal = new Vector3()
const tmpHit = new Vector3()
const tmpDesired = new Vector3()
const tmpDelta = new Vector3()

/**
 * A glossy Blender shape that can be grabbed and thrown.
 *
 * Idle it bobs and turns slowly. On pointer down it switches to a drag plane
 * that faces the camera, tracks the pointer and derives throw velocity from
 * the frame-to-frame movement. On release a damped spring walks it home.
 */
export function DraggableShape({
  url,
  position = [0, 0, 0],
  scale = 1,
  drift = 1,
  spin = [0.08, 0.12, 0.04],
  returnStrength = 0.55,
  visible,
}: Props) {
  const gltf = useGLTF(url)
  const group = useRef<Group>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  const mesh = useMemo(() => {
    const scene = gltf.scene.clone(true)
    // clone the materials too, otherwise every instance shares one material
    // and they would light as one object
    scene.traverse((child) => {
      const anyChild = child as unknown as { material?: Material | Material[] }
      if (!anyChild.material) return
      anyChild.material = Array.isArray(anyChild.material)
        ? anyChild.material.map((m) => m.clone())
        : anyChild.material.clone()
    })
    return scene
  }, [gltf])

  // three.js raycasting ignores `visible`, so a shape parked off-stage would
  // still swallow pointer events. Detach its raycast while it is hidden.
  const raycasters = useMemo(() => {
    const map = new Map<object, (...args: never[]) => void>()
    mesh.traverse((child) => {
      const target = child as unknown as { raycast?: (...args: never[]) => void }
      if (typeof target.raycast === 'function') map.set(child, target.raycast)
    })
    return map
  }, [mesh])

  const setPickable = useCallback(
    (on: boolean) => {
      raycasters.forEach((fn, node) => {
        const target = node as unknown as { raycast: unknown }
        target.raycast = on ? fn : () => undefined
      })
    },
    [raycasters],
  )

  useEffect(() => () => setPickable(true), [setPickable])

  const home = useMemo(() => new Vector3(...position), [position])
  const dragPlane = useMemo(() => new Plane(), [])
  const grabOffset = useMemo(() => new Vector3(), [])
  const prevPos = useMemo(() => new Vector3(), [])
  const velocity = useMemo(() => new Vector3(), [])
  const dragging = useRef(false)
  const lastMove = useRef(0)
  const phase = useMemo(() => hash01(url) * Math.PI * 2, [url])

  const setCursor = (value: string) => {
    gl.domElement.style.cursor = value
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    dragging.current = true
    scroll.dragging = true
    setCursor('grabbing')
    audio.unlock()
    audio.play('click')

    // drag in a plane through the shape that faces the camera
    camera.getWorldDirection(tmpNormal).negate()
    dragPlane.setFromNormalAndCoplanarPoint(tmpNormal, group.current!.position)

    if (e.ray.intersectPlane(dragPlane, tmpHit)) {
      grabOffset.copy(group.current!.position).sub(tmpHit)
    } else {
      grabOffset.set(0, 0, 0)
    }
    prevPos.copy(group.current!.position)
    lastMove.current = performance.now()

    // keep receiving move events once the cursor leaves the mesh
    capturePointer(e)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !group.current) return
    e.stopPropagation()
    if (!e.ray.intersectPlane(dragPlane, tmpHit)) return

    tmpDesired.copy(tmpHit).add(grabOffset)
    // scale by real elapsed time so a throw lands the same at 60 and 120fps
    const now = performance.now()
    const dt = Math.max(0.008, (now - lastMove.current) / 1000)
    lastMove.current = now
    velocity.copy(tmpDesired).sub(prevPos).divideScalar(dt).clampLength(0, 15)
    prevPos.copy(tmpDesired)
    group.current.position.copy(tmpDesired)
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    dragging.current = false
    scroll.dragging = false
    setCursor('grab')
    releasePointer(e)
  }

  useFrame((state, rawDelta) => {
    const g = group.current
    if (!g) return
    const delta = Math.min(rawDelta, 0.05)
    const time = state.clock.elapsedTime

    // Physics always runs, even off-stage: bailing out early would strand a
    // shape wherever it was last thrown instead of letting it walk home.
    const shown = !visible || visible()
    if (g.visible !== shown) {
      g.visible = shown
      setPickable(shown)
    }

    if (!dragging.current) {
      // Damped spring home. Tuned so a hard throw still walks back in about a
      // second and a half: strong enough to feel deliberate, not so strong the
      // shape snaps back and looks glued to its slot.
      const stiffness = 3.0 * returnStrength + 1.3
      const damping = 3.4 + returnStrength * 3.0

      tmpDelta.copy(home).sub(g.position).multiplyScalar(stiffness)
      velocity.addScaledVector(tmpDelta, delta)
      velocity.multiplyScalar(Math.max(0, 1 - damping * delta))
      g.position.addScaledVector(velocity, delta)

      if (drift > 0) {
        g.position.y += Math.sin(time * 0.7 + phase) * 0.0016 * drift
        g.rotation.x += spin[0] * delta * drift
        g.rotation.y += spin[1] * delta * drift
        g.rotation.z += spin[2] * delta * drift
      }
    } else {
      // tumble while it is being thrown around
      tmpDelta.copy(velocity).multiplyScalar(0.0009)
      g.rotation.x += tmpDelta.z
      g.rotation.z -= tmpDelta.x
    }
  })

  return (
    <group ref={group} position={position} scale={scale}>
      <primitive
        object={mesh}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          if (dragging.current) return
          setCursor('grab')
          scroll.hovering = true
          audio.unlock()
          audio.play('hover')
          const point = normalizedCanvasPoint(e, gl.domElement)
          pushRipple(point.x, point.y)
        }}
        onPointerOut={() => {
          // while any shape is being dragged, leave the cursor alone: other
          // shapes drift in and out of the ray and would clear it mid-throw
          if (dragging.current || scroll.dragging) return
          setCursor('')
          scroll.hovering = false
        }}
      />
    </group>
  )
}

useGLTF.preload(asset('/assets/3d/orb.glb'))
useGLTF.preload(asset('/assets/3d/torus.glb'))
useGLTF.preload(asset('/assets/3d/blob_a.glb'))
useGLTF.preload(asset('/assets/3d/pebble.glb'))
useGLTF.preload(asset('/assets/3d/capsule.glb'))
useGLTF.preload(asset('/assets/3d/crystal_ball.glb'))
useGLTF.preload(asset('/assets/3d/star_burst.glb'))
