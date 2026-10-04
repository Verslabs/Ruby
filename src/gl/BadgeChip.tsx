import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { Group, Material, Mesh, Plane, SRGBColorSpace, Vector3 } from 'three'
import { audio } from '../lib/audio'
import { pushRipple, scroll } from '../lib/scrollState'
import { asset } from '../lib/asset'
import { capturePointer, normalizedCanvasPoint, releasePointer } from './pointer'

type Props = {
  id: string
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  visible?: () => boolean
}

const tmpNormal = new Vector3()
const tmpHit = new Vector3()
const tmpDesired = new Vector3()
const tmpDelta = new Vector3()

/**
 * A language chip: the Blender plaque with the Inkscape logo laid over its
 * face. Draggable, and it always walks back to where it started.
 */
export function BadgeChip({ id, position, rotation = [0.2, 0.3, 0], scale = 1, visible }: Props) {
  const gltf = useGLTF(asset(`/assets/3d/badge_${id}.glb`))
  const logo = useTexture(asset(`/assets/vectors/${id}.png`))

  const group = useRef<Group>(null)
  const face = useRef<Mesh>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  // Configure the texture. These three assignments are idempotent and cheap,
  // so doing them in the render body is fine; a useMemo would only be hiding a
  // side effect. useTexture caches per URL, so each chip owns its own texture.
  logo.colorSpace = SRGBColorSpace
  logo.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  logo.needsUpdate = true

  // keep the pristine raycast so it can be restored when the chip comes back
  const faceRaycast = useRef<Mesh['raycast']>(Mesh.prototype.raycast)

  const mesh = useMemo(() => {
    const scene = gltf.scene.clone(true)
    scene.traverse((child) => {
      const anyChild = child as unknown as { material?: Material | Material[] }
      if (!anyChild.material) return
      anyChild.material = Array.isArray(anyChild.material)
        ? anyChild.material.map((m) => m.clone())
        : anyChild.material.clone()
    })
    return scene
  }, [gltf])

  // three.js raycasting ignores `visible`, so an off-stage chip would still
  // swallow pointer events. Detach its raycast while it is hidden.
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
      // the logo plane is a sibling of the plaque, so handle it separately
      if (face.current) {
        const target = face.current as unknown as { raycast: unknown }
        target.raycast = on ? faceRaycast : () => undefined
      }
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
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const lift = useRef(0)

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

    camera.getWorldDirection(tmpNormal).negate()
    dragPlane.setFromNormalAndCoplanarPoint(tmpNormal, group.current!.position)
    if (e.ray.intersectPlane(dragPlane, tmpHit)) {
      grabOffset.copy(group.current!.position).sub(tmpHit)
    } else {
      grabOffset.set(0, 0, 0)
    }
    prevPos.copy(group.current!.position)
    lastMove.current = performance.now()
    capturePointer(e)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || !group.current) return
    e.stopPropagation()
    if (!e.ray.intersectPlane(dragPlane, tmpHit)) return

    tmpDesired.copy(tmpHit).add(grabOffset)
    const now = performance.now()
    const dt = Math.max(0.008, (now - lastMove.current) / 1000)
    lastMove.current = now
    velocity.copy(tmpDesired).sub(prevPos).divideScalar(dt).clampLength(0, 11)
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
    // chip wherever it was last thrown instead of letting it walk home.
    const shown = !visible || visible()
    if (g.visible !== shown) {
      g.visible = shown
      setPickable(shown)
    }

    if (dragging.current) {
      lift.current += (1 - lift.current) * Math.min(1, delta * 8)
    } else {
      // chips are smaller and lighter than the hero shapes, so they come home
      // quicker
      tmpDelta.copy(home).sub(g.position).multiplyScalar(5.0)
      velocity.addScaledVector(tmpDelta, delta)
      velocity.multiplyScalar(Math.max(0, 1 - 6.8 * delta))
      g.position.addScaledVector(velocity, delta)
      lift.current += (0 - lift.current) * Math.min(1, delta * 5)

      // idle float, kept small so it never fights the spring
      g.position.y += Math.sin(time * 0.6 + phase) * 0.0022
      // the sway is deliberately shallow: past about 15 degrees the chip
      // foreshortens into a lozenge and stops reading as a square tile
      g.rotation.y += (rotation[1] + Math.sin(time * 0.35 + phase) * 0.12 - g.rotation.y) * delta * 2
      g.rotation.x += (rotation[0] - g.rotation.x) * delta * 2
    }

    // pop forward a little when picked up
    g.scale.setScalar(scale * (1 + lift.current * 0.12))
  })

  return (
    <group
      ref={group}
      position={position}
      rotation={rotation}
      scale={scale}
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
        // leave the cursor alone while anything is being dragged
        if (dragging.current || scroll.dragging) return
        setCursor('')
        scroll.hovering = false
      }}
    >
      {/* glTF is Y-up, so Blender's flat chip arrives lying face-up. Tipping it
          90 degrees about X stands it up facing the camera, which is the frame
          `rotation` and the drag plane are both expressed in. */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={mesh} />
      </group>

      {/* the logo plane sits just proud of the plaque face, and is left
          unrotated so its own normal already points at the camera */}
      <mesh ref={face} position={[0, 0, 0.185]}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshBasicMaterial
          map={logo}
          transparent
          toneMapped={false}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
    </group>
  )
}

useGLTF.preload(asset('/assets/3d/badge_kotlin.glb'))
useGLTF.preload(asset('/assets/3d/badge_java.glb'))
useGLTF.preload(asset('/assets/3d/badge_python.glb'))
useGLTF.preload(asset('/assets/3d/badge_javascript.glb'))
useGLTF.preload(asset('/assets/3d/badge_typescript.glb'))
