import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three'
import { samplePalettes } from '../lib/palettes'
import { scroll } from '../lib/scrollState'

const COUNT = 900

type Props = {
  /** bump this to re-fire the burst */
  trigger: number
  origin?: [number, number, number]
}

/**
 * Particle burst for the contact stage.
 *
 * A single Points draw call. Positions and velocities live in typed arrays,
 * which keeps 900 particles off the React render path entirely. Bumping
 * `trigger` re-seeds every particle at the origin and fires it outward.
 */
export function ParticleBurst({ trigger, origin = [0, 0, 0] }: Props) {
  const points = useRef<Points>(null)

  const { geometry, material, positions, velocities, lives } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT * 3)
    const lives = new Float32Array(COUNT)
    const seeds = new Float32Array(COUNT)

    for (let i = 0; i < COUNT; i++) {
      lives[i] = 0
      seeds[i] = Math.random()
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('aLife', new BufferAttribute(lives, 1))
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1))
    // the shader positions everything, so the bounding sphere must not cull it
    geometry.boundingSphere = null

    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uColorA: { value: new Color('#f7a1c6') },
        uColorB: { value: new Color('#52d6f7') },
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aLife;
        attribute float aSeed;
        uniform float uScale;
        varying float vLife;
        varying float vSeed;

        void main() {
          vLife = aLife;
          vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // fade in fast, fall away slowly; size shrinks with the remaining life
          float size = (26.0 + 34.0 * aSeed) * uScale * smoothstep(0.0, 0.12, aLife) * aLife;
          gl_PointSize = max(0.0, size * (12.0 / max(1.0, -mv.z)));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vLife;
        varying float vSeed;

        void main() {
          if (vLife <= 0.0) discard;
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d);
          if (r > 0.5) discard;
          // soft round sprite with a hot core
          float falloff = smoothstep(0.5, 0.0, r);
          float core = smoothstep(0.22, 0.0, r);
          vec3 col = mix(uColorA, uColorB, vSeed);
          vec3 rgb = col * falloff * vLife + vec3(1.0) * core * vLife * 0.55;
          gl_FragColor = vec4(rgb, falloff * vLife);
        }
      `,
    })

    return { geometry, material, positions, velocities, lives }
  }, [])

  const lastTrigger = useRef(trigger)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const p = points.current
    if (!p) return

    if (trigger !== lastTrigger.current) {
      lastTrigger.current = trigger
      // fire from the origin in a mostly even sphere, biased upward so it
      // reads as a burst rather than a puff
      for (let i = 0; i < COUNT; i++) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(1 - Math.random() * 1.65)
        const speed = 2.4 + Math.random() * 5.6

        positions[i * 3] = origin[0] + (Math.random() - 0.5) * 0.25
        positions[i * 3 + 1] = origin[1] + (Math.random() - 0.5) * 0.25
        positions[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 0.25

        velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
        velocities[i * 3 + 1] = Math.cos(phi) * speed + 1.8
        velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.45

        lives[i] = 0.85 + Math.random() * 0.9
      }
    }

    let alive = false
    for (let i = 0; i < COUNT; i++) {
      if (lives[i] <= 0) continue
      alive = true
      const j = i * 3

      velocities[j + 1] -= 5.4 * delta
      // drag, so particles settle instead of flying forever
      const drag = Math.max(0, 1 - 1.5 * delta)
      velocities[j] *= drag
      velocities[j + 1] *= drag
      velocities[j + 2] *= drag

      positions[j] += velocities[j] * delta
      positions[j + 1] += velocities[j + 1] * delta
      positions[j + 2] += velocities[j + 2] * delta

      lives[i] -= delta * 0.62
      if (lives[i] < 0) lives[i] = 0
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aLife.needsUpdate = true
    p.visible = alive

    const palette = samplePalettes(scroll.progress)
    ;(material.uniforms.uColorA.value as Color).copy(palette.ribbonA)
    ;(material.uniforms.uColorB.value as Color).copy(palette.ribbonB)
  })

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />
}
