// Generates the site's sounds as 16-bit stereo PCM WAV files.
// Everything is synthesised so the repo stays free of binary blobs that
// nobody can regenerate. Run with: npm run audio
//
// The random source is seeded, so running it twice writes identical files.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/audio')
mkdirSync(OUT, { recursive: true })

const SR = 44100
const TAU = Math.PI * 2

// mulberry32: small, fast, and good enough for noise
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const random = seeded(0x52756279) // "Ruby"
const noise = () => random() * 2 - 1

const stereo = (seconds, sr = SR) => {
  const n = Math.round(seconds * sr)
  return [new Float32Array(n), new Float32Array(n)]
}

/** Adds a mono sample at an equal-power pan position, -1 (left) to 1 (right). */
function put([L, R], i, value, pan = 0) {
  if (i < 0 || i >= L.length) return
  const angle = ((pan + 1) * Math.PI) / 4
  L[i] += value * Math.cos(angle)
  R[i] += value * Math.sin(angle)
}

/** Soft attack, exponential decay. Times in seconds. */
const ad = (t, attack, decay) => (1 - Math.exp(-t / attack)) * Math.exp(-t / decay)

/** Chamberlin state-variable filter. Call with a cutoff each sample. */
function svf(q = 0.7, sr = SR) {
  let low = 0
  let band = 0
  return (input, cutoff) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, sr / 6)) / sr)
    low += f * band
    const high = input - low - q * band
    band += f * high
    return { low, band, high }
  }
}

/**
 * Freeverb: eight damped combs into four allpasses per side, with the right
 * side's delays offset so the tail is wide. Returns a new pair.
 */
function reverb([L, R], { size = 0.8, damp = 0.35, wet = 0.3, sr = SR } = {}) {
  const scale = sr / 44100
  const side = (spread) => ({
    combs: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({
      buf: new Float32Array(Math.round((d + spread) * scale)),
      i: 0,
      store: 0,
    })),
    passes: [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 })),
  })
  const sides = [side(0), side(23)]
  const n = L.length
  const out = [new Float32Array(n), new Float32Array(n)]
  const dry = 1 - wet * 0.5
  for (let i = 0; i < n; i++) {
    const input = (L[i] + R[i]) * 0.015
    for (let c = 0; c < 2; c++) {
      let acc = 0
      for (const comb of sides[c].combs) {
        const y = comb.buf[comb.i]
        comb.store = y * (1 - damp) + comb.store * damp
        comb.buf[comb.i] = input + comb.store * size
        if (++comb.i >= comb.buf.length) comb.i = 0
        acc += y
      }
      for (const pass of sides[c].passes) {
        const b = pass.buf[pass.i]
        pass.buf[pass.i] = acc + b * 0.5
        acc = b - acc
        if (++pass.i >= pass.buf.length) pass.i = 0
      }
      out[c][i] = (c === 0 ? L : R)[i] * dry + acc * wet * 3
    }
  }
  return out
}

/**
 * Normalises to `peak`, trims silence off the end and writes the file. A
 * one-shot gets a short fade so it never ends on a click; a loop is written
 * untouched so its seam stays seamless.
 */
function writeWav(name, [L, R], { sr = SR, peak = 0.85, loop = false } = {}) {
  let max = 0
  for (let i = 0; i < L.length; i++) max = Math.max(max, Math.abs(L[i]), Math.abs(R[i]))
  const gain = max > 0 ? peak / max : 1

  let n = L.length
  if (!loop) {
    // -54 dB below full scale: past this, a reverb tail is inaudible on a laptop
    const floor = 0.002 / gain
    while (n > 1 && Math.abs(L[n - 1]) < floor && Math.abs(R[n - 1]) < floor) n--
    const fade = Math.min(n, Math.round(sr * 0.012))
    for (let k = 0; k < fade; k++) {
      const g = k / fade
      L[n - 1 - k] *= g
      R[n - 1 - k] *= g
    }
  }

  const buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 4, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(2, 22) // stereo
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4)
  }
  writeFileSync(resolve(OUT, name), buf)
}

/** A struck bell-ish note: a few partials, the higher ones dying faster. */
function bell(out, start, freq, { gain = 1, pan = 0, decay = 0.35, sr = SR } = {}) {
  const partials = [
    [1, 1, 1],
    [2, 0.28, 0.45],
    [2.76, 0.12, 0.22],
    [3.01, 0.07, 0.3],
  ]
  const n = Math.round(decay * 7 * sr)
  const s0 = Math.round(start * sr)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    let s = 0
    for (const [ratio, amp, life] of partials) s += Math.sin(TAU * freq * ratio * t) * amp * ad(t, 0.002, decay * life)
    put(out, s0 + i, s * gain, pan)
  }
}

// ---------------------------------------------------------------- ambient
// A slow, wide Am9 pad with a breath of filtered air. Every frequency and LFO
// is a whole number of cycles per loop, and the reverb is run over two
// passes with only the second kept, so its tail wraps across the seam too.
function ambient(duration = 12, sr = 32000) {
  const n = Math.round(duration * sr)
  const q = (f) => Math.round(f * duration) / duration
  const notes = [
    { f: 55, g: 0.55, pan: 0 },
    { f: 110, g: 0.4, pan: -0.15 },
    { f: 130.81, g: 0.22, pan: 0.35 },
    { f: 164.81, g: 0.26, pan: -0.4 },
    { f: 196, g: 0.16, pan: 0.5 },
    { f: 246.94, g: 0.12, pan: -0.55 },
  ]
  const voices = notes.flatMap((note, index) =>
    [-1, 1].map((side) => ({
      f: q(note.f * (1 + side * 0.0022)),
      g: note.g,
      pan: Math.max(-1, Math.min(1, note.pan + side * 0.25)),
      swell: (1 + (index % 3)) / duration,
      bright: (1 + ((index + 1) % 2)) / duration,
      ph: random() * TAU,
    })),
  )

  // periodic noise, so the air loops as cleanly as the tones
  const air = Float32Array.from({ length: n }, noise)
  const airFilter = svf(0.9, sr)

  const dry = stereo((2 * n) / sr, sr)
  for (let i = 0; i < 2 * n; i++) {
    const t = (i % n) / sr
    for (const v of voices) {
      const level = 0.55 + 0.45 * Math.sin(TAU * v.swell * t + v.ph)
      const bright = 0.5 + 0.5 * Math.sin(TAU * v.bright * t + v.ph * 0.7)
      let s = 0
      for (let h = 1; h <= 4; h++) s += (Math.sin(TAU * v.f * h * t + v.ph * h) / h ** 1.8) * (h === 1 ? 1 : bright)
      put(dry, i, s * v.g * level, v.pan)
    }
    const breath = 0.5 - 0.5 * Math.cos((TAU * t) / duration)
    const { band } = airFilter(air[i % n], 700 + 500 * breath)
    put(dry, i, band * 0.05 * breath, Math.sin((TAU * 2 * t) / duration) * 0.6)
  }

  const [L, R] = reverb(dry, { size: 0.9, damp: 0.45, wet: 0.5, sr })
  return [L.slice(n), R.slice(n)]
}

// ------------------------------------------------------------------ click
// A soft wooden "tock": a quick downward pitch drop with a knock of noise,
// then a short room.
function click() {
  const out = stereo(0.45)
  const knock = svf(1.2)
  let phase = 0
  for (let i = 0; i < SR * 0.12; i++) {
    const t = i / SR
    phase += (TAU * (360 + 300 * Math.exp(-t * 90))) / SR
    const body = (Math.sin(phase) + Math.sin(phase * 2.43) * 0.22 * Math.exp(-t * 80)) * ad(t, 0.0006, 0.028)
    const tick = knock(noise(), 3200).band * Math.exp(-t * 420) * 0.6
    put(out, i, body + tick)
  }
  return reverb(out, { size: 0.7, damp: 0.5, wet: 0.16 })
}

// ------------------------------------------------------------------- hover
// A small glassy ping, quiet enough to run across a row of links.
function hover() {
  const out = stereo(0.4)
  for (let i = 0; i < SR * 0.2; i++) {
    const t = i / SR
    const s =
      Math.sin(TAU * 1318.5 * t) * ad(t, 0.004, 0.045) +
      Math.sin(TAU * 2637 * t) * 0.16 * ad(t, 0.002, 0.02) +
      Math.sin(TAU * 3955.5 * t) * 0.05 * ad(t, 0.001, 0.012)
    put(out, i, s)
  }
  return reverb(out, { size: 0.74, damp: 0.4, wet: 0.24 })
}

// -------------------------------------------------------------- transition
// The stage change: a band of air that opens, sweeps left to right and
// settles, over a low swell, with a faint chord glinting at the crest.
function transition() {
  const length = 1.3
  const out = stereo(length + 1.4)
  const band = svf(0.55)
  let swell = 0
  for (let i = 0; i < SR * length; i++) {
    const t = i / SR
    const p = t / length
    const shape = Math.sin(Math.PI * p) ** 1.6
    const cutoff = 380 + 2900 * Math.sin(Math.PI * Math.min(1, p * 1.25)) ** 2
    const air = band(noise(), cutoff).band * shape * 0.5
    put(out, i, air, -0.75 + 1.5 * p)
    swell += (TAU * (98 + 49 * p)) / SR
    put(out, i, Math.sin(swell) * shape * 0.22)
  }
  ;[659.25, 880, 1108.73].forEach((f, k) => bell(out, 0.42 + k * 0.07, f, { gain: 0.05, pan: -0.4 + k * 0.4, decay: 0.3 }))
  return reverb(out, { size: 0.86, damp: 0.4, wet: 0.36 })
}

// ------------------------------------------------------------- open, close
// A soft glide up a fifth for opening a panel, and the same back down.
function glide(from, to, decay) {
  const out = stereo(1.4)
  const phases = [0, 0]
  for (let i = 0; i < SR * decay * 6; i++) {
    const t = i / SR
    const f = to + (from - to) * Math.exp(-t * 26)
    phases[0] += (TAU * f) / SR
    phases[1] += (TAU * f * 2.003) / SR
    const env = ad(t, 0.006, decay)
    put(out, i, Math.sin(phases[0]) * env, -0.2)
    put(out, i, Math.sin(phases[1]) * env * 0.22, 0.3)
  }
  return reverb(out, { size: 0.82, damp: 0.4, wet: 0.3 })
}

// --------------------------------------------------------------------- pop
// The confetti: a round pop, then sparkles scattered across the stereo field.
function pop() {
  const out = stereo(1.8)
  const crack = svf(1)
  let phase = 0
  for (let i = 0; i < SR * 0.25; i++) {
    const t = i / SR
    phase += (TAU * (170 + 950 * Math.exp(-t * 55))) / SR
    put(out, i, Math.sin(phase) * ad(t, 0.0008, 0.05) + crack(noise(), 1600).band * Math.exp(-t * 140) * 0.35)
  }
  const scale = [1760, 1975.53, 2349.32, 2637.02, 2959.96, 3520]
  for (let k = 0; k < 11; k++) {
    bell(out, 0.03 + random() * 0.5, scale[Math.floor(random() * scale.length)], {
      gain: 0.07 + random() * 0.07,
      pan: random() * 1.6 - 0.8,
      decay: 0.08 + random() * 0.06,
    })
  }
  return reverb(out, { size: 0.84, damp: 0.35, wet: 0.32 })
}

// ----------------------------------------------------------------- success
// A rising E major arpeggio, for a post going live.
function success() {
  const out = stereo(2.2)
  ;[659.25, 830.61, 987.77, 1318.51].forEach((f, k) =>
    bell(out, k * 0.085, f, { gain: k === 3 ? 0.5 : 0.8, pan: -0.36 + k * 0.24, decay: 0.42 }),
  )
  return reverb(out, { size: 0.84, damp: 0.38, wet: 0.34 })
}

// ------------------------------------------------------------------- error
// Two muffled knocks stepping down. Says "no" without an alarm.
function error() {
  const out = stereo(0.9)
  const thump = svf(0.8)
  ;[
    [0, 233.08],
    [0.14, 174.61],
  ].forEach(([start, f]) => {
    const s0 = Math.round(start * SR)
    for (let i = 0; i < SR * 0.3; i++) {
      const t = i / SR
      const body = (Math.sin(TAU * f * t) + Math.sin(TAU * f * 2 * t) * 0.18) * ad(t, 0.002, 0.07)
      put(out, s0 + i, body + thump(noise(), 500).band * Math.exp(-t * 90) * 0.25)
    }
  })
  return reverb(out, { size: 0.7, damp: 0.55, wet: 0.18 })
}

writeWav('ambient.wav', ambient(), { sr: 32000, peak: 0.7, loop: true })
writeWav('click.wav', click())
writeWav('hover.wav', hover())
writeWav('transition.wav', transition())
writeWav('open.wav', glide(392, 587.33, 0.16))
writeWav('close.wav', glide(587.33, 392, 0.11))
writeWav('pop.wav', pop())
writeWav('success.wav', success())
writeWav('error.wav', error())
console.log('wrote audio to', OUT)
