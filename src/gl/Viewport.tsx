import { Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { scroll } from '../lib/scrollState'
import { asset } from '../lib/asset'
import { weightFor } from '../lib/stageRanges'
import { applyEnvironment } from './env'
import { PaletteRig } from './PaletteRig'
import { CameraRig } from './CameraRig'
import { PostFX } from './PostFX'
import { WaveBackdrop } from './WaveBackdrop'
import { DraggableShape } from './DraggableShape'
import { BadgeChip } from './BadgeChip'
import { ParticleBurst } from './ParticleBurst'

/**
 * True on portrait-ish viewports.
 *
 * The scene layouts below are authored for a landscape frame. At 390x844 the
 * visible world width collapses to about a third of its height, so shapes
 * placed out at the edges fall off-screen entirely or land on top of the
 * copy. Compact gets its own placement instead.
 */
function useCompactLayout() {
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  return width / Math.max(1, height) < 0.95
}

/** Advances the shared clock once per frame. Every shader reads from it. */
function Clock() {
  useFrame((_, delta) => {
    scroll.clock += Math.min(delta, 0.05)
  })
  return null
}

function Environment() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const env = applyEnvironment(scene)
    return () => {
      scene.environment = null
      env.dispose()
    }
  }, [scene])
  return null
}

type ShapeSpec = {
  url: string
  position: [number, number, number]
  scale: number
  spin: [number, number, number]
}

// Landscape: weighted to the right third and the corners, because the copy is
// a left column and a glossy pale shape behind bold white type is the one
// thing that would make it hard to read.
const HERO_WIDE: ShapeSpec[] = [
  { url: asset('/assets/3d/orb.glb'), position: [5.0, 1.9, -1.2], scale: 0.8, spin: [0.07, 0.13, 0.05] },
  { url: asset('/assets/3d/torus.glb'), position: [4.6, -1.9, -1.6], scale: 0.82, spin: [0.1, 0.16, 0.02] },
  { url: asset('/assets/3d/blob_a.glb'), position: [3.2, -2.9, -0.3], scale: 0.72, spin: [0.06, 0.11, 0.09] },
  { url: asset('/assets/3d/pebble.glb'), position: [-5.2, -2.4, -1.6], scale: 0.7, spin: [0.09, 0.07, 0.06] },
  { url: asset('/assets/3d/capsule.glb'), position: [-5.3, 2.6, -2.4], scale: 0.46, spin: [0.12, 0.14, 0.03] },
  { url: asset('/assets/3d/star_burst.glb'), position: [0.2, 3.1, -2.2], scale: 0.42, spin: [0.05, 0.09, 0.07] },
  { url: asset('/assets/3d/crystal_ball.glb'), position: [5.5, 2.6, -3.6], scale: 0.6, spin: [0.08, 0.12, 0.04] },
]

// Portrait: the copy owns the middle of a tall screen, so the shapes are pushed
// well back (small, background) and pushed into the clear bands above and below.
const HERO_TALL: ShapeSpec[] = [
  { url: asset('/assets/3d/orb.glb'), position: [1.2, 3.4, -3.4], scale: 0.5, spin: [0.07, 0.13, 0.05] },
  { url: asset('/assets/3d/torus.glb'), position: [-1.25, -3.0, -3.0], scale: 0.5, spin: [0.1, 0.16, 0.02] },
  { url: asset('/assets/3d/blob_a.glb'), position: [1.3, -3.9, -3.6], scale: 0.44, spin: [0.06, 0.11, 0.09] },
  { url: asset('/assets/3d/pebble.glb'), position: [-1.2, 4.0, -4.0], scale: 0.42, spin: [0.09, 0.07, 0.06] },
  { url: asset('/assets/3d/capsule.glb'), position: [0.7, -3.5, -4.6], scale: 0.3, spin: [0.12, 0.14, 0.03] },
  { url: asset('/assets/3d/star_burst.glb'), position: [-0.6, 2.9, -4.4], scale: 0.3, spin: [0.05, 0.09, 0.07] },
  { url: asset('/assets/3d/crystal_ball.glb'), position: [-1.3, -2.9, -5.0], scale: 0.34, spin: [0.08, 0.12, 0.04] },
]

/**
 * Stage 1 shapes. They drift on idle and the visitor can grab and throw them,
 * so the first screen is never a static render.
 */
function HeroShapes() {
  const compact = useCompactLayout()
  // the stage 1 shapes stay through the about stage, then get out of the way
  const visible = () => weightFor('hero') > 0.01 || weightFor('about') > 0.01
  const specs = compact ? HERO_TALL : HERO_WIDE

  return (
    <group>
      {specs.map((s) => (
        <DraggableShape
          key={s.url}
          url={s.url}
          position={s.position}
          scale={s.scale}
          spin={s.spin}
          visible={visible}
        />
      ))}
    </group>
  )
}

/** Stage 4: a large soft shape drifting behind the leadership cards. */
function ExperienceShape() {
  const compact = useCompactLayout()
  return (
    <DraggableShape
      url={asset('/assets/3d/orb.glb')}
      position={compact ? [2.2, 3.2, -4.0] : [5.5, 3.0, -4.0]}
      scale={compact ? 0.9 : 1.3}
      spin={[0.05, 0.08, 0.03]}
      returnStrength={0.35}
      visible={() => weightFor('experience') > 0.01}
    />
  )
}

/** Stage 3: the language chips, scattered across the wave backdrop. */
function StackBadges() {
  const compact = useCompactLayout()

  // Landscape: weighted to the right half, since the stage copy is a left
  // column. Depth varies per chip so the scatter reads as a space.
  const wide: {
    id: string
    position: [number, number, number]
    rotation: [number, number, number]
    scale: number
  }[] = [
    { id: 'kotlin', position: [3.0, 2.2, -0.4], rotation: [0.12, 0.18, -0.05], scale: 0.95 },
    { id: 'java', position: [4.3, 0.4, -1.4], rotation: [-0.1, -0.15, 0.06], scale: 0.8 },
    { id: 'python', position: [2.6, -1.8, -0.2], rotation: [0.08, 0.22, 0.04], scale: 0.9 },
    { id: 'javascript', position: [1.2, 2.9, -2.2], rotation: [-0.12, 0.15, -0.07], scale: 0.7 },
    { id: 'typescript', position: [4.6, -2.4, -1.8], rotation: [0.16, -0.12, 0.03], scale: 0.75 },
  ]

  // Portrait: pushed back and down, so the chips read as depth behind the
  // notes rather than furniture sitting on the heading.
  const tall = wide.map((c, i) => ({
    ...c,
    position: [c.position[0] * 0.42, c.position[1] * 0.62 - 0.7, c.position[2] - 1.6] as [number, number, number],
    scale: c.scale * 0.5,
    rotation: [c.rotation[0], c.rotation[1], c.rotation[2] + (i % 2 ? 0.05 : -0.05)] as [number, number, number],
  }))

  const layout = compact ? tall : wide

  return (
    <group>
      {layout.map((chip) => (
        <BadgeChip
          key={chip.id}
          id={chip.id}
          position={chip.position}
          rotation={chip.rotation}
          scale={chip.scale}
          visible={() => weightFor('stack') > 0.01}
        />
      ))}
    </group>
  )
}

/**
 * Stage 5: the particle burst. `burstKey` is bumped by the contact button.
 * The group rides with the camera so the burst always lands on screen.
 */
function ContactBurst({ burstKey }: { burstKey: number }) {
  return (
    <group position={[0, 0, 1.5]}>
      <ParticleBurst trigger={burstKey} origin={[0, -0.4, 0]} />
    </group>
  )
}

export function Viewport({ burstKey }: { burstKey: number }) {
  return (
    <div className="fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          // the liquid pass takes over rendering, so the canvas itself does not
          // need to clear
          stencil: false,
        }}
        camera={{ fov: 42, near: 0.1, far: 100, position: [0, 0, 9.4] }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Clock />
        <Environment />
        <PaletteRig />
        <CameraRig />
        <WaveBackdrop opacity={() => weightFor('stack')} />
        <Suspense fallback={null}>
          <HeroShapes />
          <ExperienceShape />
          <StackBadges />
        </Suspense>
        <ContactBurst burstKey={burstKey} />
        <PostFX />
      </Canvas>
    </div>
  )
}
