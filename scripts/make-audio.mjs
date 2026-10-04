// Generates the audio bed for the site as 16-bit PCM WAV files.
// Everything is synthesised so the repo stays free of binary blobs that
// nobody can regenerate. Run with: node scripts/make-audio.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/audio')
mkdirSync(OUT, { recursive: true })

const SR = 44100

function writeWav(name, samples) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  writeFileSync(resolve(OUT, name), buf)
  return name
}

const clamp = (v) => Math.max(-1, Math.min(1, v))

// ---------------------------------------------------------------- ambient
// Every partial and LFO below is an exact multiple of 1/duration, so the
// loop point has no click. 55 Hz is a low A1; the rest stack octaves and a
// fifth over it, kept well under the level where it reads as "music".
function ambient(duration = 8) {
  const n = Math.round(SR * duration)
  const base = 1 / duration
  const partials = [
    { f: 55, g: 0.5 },
    { f: 82.5, g: 0.22 },
    { f: 110, g: 0.16 },
    { f: 165, g: 0.07 },
    { f: 27.5, g: 0.3 },
  ].map((p) => ({ ...p, ph: Math.random() * Math.PI * 2 }))

  const out = new Float32Array(n)
  // one-pole lowpass, gentle so the top end never gets brittle
  let lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    let s = 0
    for (const p of partials) {
      const lfo = 0.55 + 0.45 * Math.sin(2 * Math.PI * base * (1 + partials.indexOf(p) % 2) * t + p.ph)
      s += Math.sin(2 * Math.PI * p.f * t + p.ph) * p.g * lfo
    }
    lp += (s - lp) * 0.09
    // fade the very edges so the loop breathes instead of clicking
    const edge = Math.min(1, Math.min(i, n - i) / (SR * 0.12))
    out[i] = lp * 0.55 * edge
  }
  return out
}

// ------------------------------------------------------------------ click
// Short wooden tick for hover/press. Two decaying tones plus a touch of
// noise transient gives it a body without sounding like a beep.
function click() {
  const n = Math.round(SR * 0.07)
  const out = new Float32Array(n)
  let lp = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.exp(-t * 58)
    const tone = Math.sin(2 * Math.PI * 760 * t) * 0.5 + Math.sin(2 * Math.PI * 1140 * t) * 0.25
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 220) * 0.5
    lp += ((tone + noise) - lp) * 0.5
    out[i] = clamp(lp * env * 0.8)
  }
  return out
}

// ------------------------------------------------------------------- hover
function hover() {
  const n = Math.round(SR * 0.11)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.exp(-t * 34) * (1 - Math.exp(-t * 900))
    const s = Math.sin(2 * Math.PI * 1180 * t) * 0.6 + Math.sin(2 * Math.PI * 1770 * t) * 0.2
    out[i] = clamp(s * env * 0.5)
  }
  return out
}

// -------------------------------------------------------------- transition
// Airy sweep used when a stage changes. Noise shaped by a band that opens
// then closes, with a quiet pitch rise underneath.
function transition() {
  const n = Math.round(SR * 0.9)
  const out = new Float32Array(n)
  let lp = 0
  let hp = 0
  let prev = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const p = t / 0.9
    const sweep = Math.sin(Math.PI * p) ** 2
    const raw = Math.random() * 2 - 1
    lp += (raw - lp) * (0.02 + 0.28 * sweep)
    hp = 0.92 * (hp + lp - prev)
    prev = lp
    const rise = Math.sin(2 * Math.PI * (300 + 420 * p) * t)
    const env = Math.pow(sweep, 1.4) * 0.5
    out[i] = clamp(hp * env * 2.6 + rise * env * 0.12)
  }
  return out
}

writeWav('ambient.wav', ambient())
writeWav('click.wav', click())
writeWav('hover.wav', hover())
writeWav('transition.wav', transition())
console.log('wrote audio to', OUT)