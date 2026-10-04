import { DataTexture, EquirectangularReflectionMapping, FloatType, LinearFilter, RGBAFormat, Scene } from 'three'

/**
 * Procedural equirectangular environment.
 *
 * The glossy shapes need something to reflect or they read as flat plastic.
 * Shipping an HDRI would mean a network fetch and a few megabytes, so this
 * builds a tiny gradient sky in memory instead: warm pink from above, cool
 * periwinkle from below, with a soft highlight where the key light sits.
 */
export function makeGradientEnv(): DataTexture {
  const w = 64
  const h = 32
  const data = new Float32Array(w * h * 4)

  // sRGB -> linear so the colours survive the trip into the render target
  const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

  const top: [number, number, number] = [toLinear(0.97), toLinear(0.79), toLinear(0.88)]
  const bottom: [number, number, number] = [toLinear(0.29), toLinear(0.38), toLinear(0.63)]
  const keyDir = { x: 0.35, y: 0.72 }

  for (let y = 0; y < h; y++) {
    // v=0 is the top of the equirect map
    const v = y / (h - 1)
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1)
      const theta = v * Math.PI
      const phi = u * Math.PI * 2

      // direction this texel represents
      const dx = Math.sin(theta) * Math.cos(phi)
      const dy = Math.cos(theta)

      const t = 1 - v
      let r = top[0] * t + bottom[0] * (1 - t)
      let g = top[1] * t + bottom[1] * (1 - t)
      let b = top[2] * t + bottom[2] * (1 - t)

      // a broad highlight where the key light sits, so reflections have a shape
      const d = dx * keyDir.x + dy * keyDir.y
      const spec = Math.max(0, d) ** 22
      r += spec * 3.2
      g += spec * 2.9
      b += spec * 2.6

      // darken the very bottom so the shapes get a grounded falloff
      const floorFade = v > 0.78 ? 1 - (v - 0.78) * 2.6 : 1
      const i = (y * w + x) * 4
      data[i] = r * floorFade
      data[i + 1] = g * floorFade
      data[i + 2] = b * floorFade
      data[i + 3] = 1
    }
  }

  const tex = new DataTexture(data, w, h, RGBAFormat, FloatType)
  tex.mapping = EquirectangularReflectionMapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.needsUpdate = true
  return tex
}

export function applyEnvironment(scene: Scene) {
  const env = makeGradientEnv()
  scene.environment = env
  scene.environmentIntensity = 0.85
  return env
}