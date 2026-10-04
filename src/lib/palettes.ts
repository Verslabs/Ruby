import { Color } from 'three'

export type PaletteDef = {
  name: string
  /** page background, also written to --stage-bg for the DOM */
  bg: string
  /** main light colour */
  key: string
  /** rim / fill light colour */
  rim: string
  /** the two colours the wave ribbons blend between */
  ribbonA: string
  ribbonB: string
}

/**
 * Five palettes, one per stage. Each keeps Ruby's pastel-to-neon range:
 * dark grounds so the glossy shapes read, saturated accents so they pop.
 */
export const PALETTES: PaletteDef[] = [
  { name: 'ink', bg: '#1a1030', key: '#ffd9ea', rim: '#6fd8ff', ribbonA: '#f7a1c6', ribbonB: '#52d6f7' },
  { name: 'grape', bg: '#271445', key: '#f7c9e8', rim: '#9d8cff', ribbonA: '#c3a5d8', ribbonB: '#7b6bff' },
  { name: 'lagoon', bg: '#06202c', key: '#cff6ff', rim: '#52d6f7', ribbonA: '#52d6f7', ribbonB: '#90bfe6' },
  { name: 'berry', bg: '#431634', key: '#ffd3e4', rim: '#ff8fc0', ribbonA: '#ff8fc0', ribbonB: '#c3a5d8' },
  { name: 'indigo', bg: '#161e52', key: '#dde6ff', rim: '#52d6f7', ribbonA: '#90bfe6', ribbonB: '#52d6f7' },
]

type Resolved = PaletteDef & {
  c: { bg: Color; key: Color; rim: Color; ribbonA: Color; ribbonB: Color }
}

const resolved: Resolved[] = PALETTES.map((p) => ({
  ...p,
  c: {
    bg: new Color(p.bg),
    key: new Color(p.key),
    rim: new Color(p.rim),
    ribbonA: new Color(p.ribbonA),
    ribbonB: new Color(p.ribbonB),
  },
}))

/** Reused every frame so sampling never allocates. */
export type PaletteSample = {
  name: string
  bg: Color
  key: Color
  rim: Color
  ribbonA: Color
  ribbonB: Color
  /** "#rrggbb" of the interpolated background, for CSS */
  bgHex: string
}

const sample: PaletteSample = {
  name: resolved[0].name,
  bg: new Color(),
  key: new Color(),
  rim: new Color(),
  ribbonA: new Color(),
  ribbonB: new Color(),
  bgHex: resolved[0].bg,
}

const hex = (c: Color) => '#' + c.getHexString()

/**
 * Samples the palette ramp at `t` (0..1 across the document). Colours are
 * interpolated in linear space so mid-way blends do not go muddy.
 */
export function samplePalettes(t: number): PaletteSample {
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (resolved.length - 1)
  const i = Math.min(resolved.length - 2, Math.floor(scaled))
  const f = scaled - i
  const a = resolved[i]
  const b = resolved[i + 1]

  sample.bg.copy(a.c.bg).lerp(b.c.bg, f)
  sample.key.copy(a.c.key).lerp(b.c.key, f)
  sample.rim.copy(a.c.rim).lerp(b.c.rim, f)
  sample.ribbonA.copy(a.c.ribbonA).lerp(b.c.ribbonA, f)
  sample.ribbonB.copy(a.c.ribbonB).lerp(b.c.ribbonB, f)
  sample.name = f < 0.5 ? a.name : b.name
  sample.bgHex = hex(sample.bg)
  return sample
}

export const PALETTE_NAMES = PALETTES.map((p) => p.name)