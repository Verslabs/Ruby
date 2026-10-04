// End-to-end interaction checks against the built site, driven through the
// same pointer/keyboard path a visitor uses. Verifies the drag physics, the
// contact burst, the mute toggle persistence, the drawer, and mobile layout.
//
// Run with: node scripts/interact.mjs
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'shots')
mkdirSync(OUT, { recursive: true })

const URL_ = process.env.URL || 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--autoplay-policy=no-user-gesture-required',
    '--hide-scrollbars',
  ],
})

const problems = []

async function newPage(width, height) {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[console.error] ${m.text()}`)
  })
  await page.goto(URL_, { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise((r) => setTimeout(r, 3500))
  return page
}

/** Mean absolute per-channel pixel difference between two PNG buffers. */
async function meanDiff(page, aBuf, bBuf) {
  return page.evaluate(async (a, b) => {
    const load = (b64) =>
      new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = rej
        img.src = 'data:image/png;base64,' + b64
      })
    const [ia, ib] = await Promise.all([load(a), load(b)])
    const c = document.createElement('canvas')
    c.width = Math.min(ia.width, ib.width)
    c.height = Math.min(ia.height, ib.height)
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(ia, 0, 0)
    const da = g.getImageData(0, 0, c.width, c.height).data
    g.clearRect(0, 0, c.width, c.height)
    g.drawImage(ib, 0, 0)
    const db = g.getImageData(0, 0, c.width, c.height).data
    let sum = 0
    for (let i = 0; i < da.length; i += 4) {
      sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
    }
    return sum / (da.length / 4) / 3
  }, aBuf.toString('base64'), bBuf.toString('base64'))
}

// --------------------------------------------------------------- drag test
{
  const page = await newPage(1440, 900)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  // Diff a tight region around the grab point: a shape is small against a
  // 1440x900 frame, so a whole-frame average drowns the signal in idle motion.
  let region = { x: 0, y: 0, width: 1440, height: 900 }
  // The animated grain layer and the mesh cursor add frame-to-frame noise that
  // would swamp the measurement, so both are removed for this check only.
  const removed = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.z-\\[70\\], .z-\\[90\\]')]
    nodes.forEach((n) => n.remove())
    return nodes.length
  })
  record('overlays removed for measurement', removed >= 2, `${removed} nodes`)
  await wait(700)

  // Find a draggable shape by probing where the canvas reports a grab cursor,
  // rather than hard-coding a pixel that drifts as the camera settles.
  let grab = null
  for (let y = 120; y <= 620 && !grab; y += 40) {
    for (let x = 300; x <= 1380; x += 40) {
      await page.mouse.move(x, y)
      await wait(25)
      const cursor = await page.evaluate(
        () => document.querySelector('canvas')?.style.cursor || '',
      )
      if (cursor === 'grab') {
        grab = { x, y }
        break
      }
    }
  }
  record('a draggable shape is under the cursor', Boolean(grab), grab ? `at ${grab.x},${grab.y}` : 'none found')

  if (grab) {
    const cx = Math.max(0, Math.min(1440 - 380, grab.x - 190))
    const cy = Math.max(0, Math.min(900 - 320, grab.y - 160))
    region = { x: cx, y: cy, width: 380, height: 320 }
  }

  if (!grab) {
    await page.close()
  } else {
  const orb = grab

  // the spot the shape is dragged to, and left at, if it does not spring back
  const dropRegion = {
    x: Math.max(0, Math.min(1440 - 260, orb.x - 14 * 34 - 130)),
    y: Math.max(0, Math.min(900 - 260, orb.y + 14 * 21 - 130)),
    width: 260,
    height: 260,
  }

  const before = await page.screenshot({ clip: region })
  const beforeDrop = await page.screenshot({ clip: dropRegion })

  // calibrate the diff helper: the same frame re-read must score near zero
  const cal = await meanDiff(page, before, before)
  record('pixel-diff helper reads zero for identical frames', cal < 0.5, `self-diff ${cal.toFixed(2)}`)

  await page.mouse.move(orb.x, orb.y)
  await wait(300)
  await page.mouse.down()
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(orb.x - i * 34, orb.y + i * 21)
    await wait(16)
  }
  await wait(150)
  const during = await page.screenshot({ clip: region })
  const duringDrop = await page.screenshot({ clip: dropRegion })
  await page.mouse.up()
  await wait(350)
  const thrown = await page.screenshot({ clip: region })

  const diffDuring = await meanDiff(page, before, during)
  const diffThrown = await meanDiff(page, before, thrown)
  record('drag moves the shape', diffDuring > 1.5, `mean pixel delta ${diffDuring.toFixed(2)}`)
  record(
    'shape keeps travelling after release',
    diffThrown > diffDuring * 0.6,
    `delta went ${diffDuring.toFixed(2)} -> ${diffThrown.toFixed(2)}`,
  )

  // and it should spring home rather than drift away
  await wait(3200)
  const settled = await page.screenshot({ clip: region })
  const settledDrop = await page.screenshot({ clip: dropRegion })
  await page.screenshot({ path: resolve(OUT, 'i-drag-before.png') })
  writeFileSync(resolve(OUT, 'i-drag-during.png'), during)
  writeFileSync(resolve(OUT, 'i-drag-settled.png'), settled)

  // "Springs home" is a claim about position, not about pixels: a thrown shape
  // also tumbles, so it never matches the start frame pixel for pixel. Measure
  // the place it was dropped instead. That patch held background before the
  // drag, held the shape while it was held there, and should hold background
  // again once the spring has walked it home.
  const held = await meanDiff(page, beforeDrop, duringDrop)
  const vacated = await meanDiff(page, beforeDrop, settledDrop)
  record('drag site is occupied while held', held > 1.5, `delta ${held.toFixed(2)}`)
  record(
    'shape is no longer left where it was dropped',
    vacated < held * 0.6,
    `drop site delta ${vacated.toFixed(2)} after settling vs ${held.toFixed(2)} while held`,
  )

  await page.screenshot({ path: resolve(OUT, 'i-after-drag.png') })
  await page.close()
  }
}

// ------------------------------------------------------- audio + drawer test
{
  const page = await newPage(1440, 900)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const toggle = await page.$('button[aria-label="Turn sound on"], button[aria-label="Turn sound off"]')
  record('sound toggle exists', Boolean(toggle))

  if (toggle) {
    const before = await page.evaluate(() => localStorage.getItem('ruby:muted'))
    await toggle.click()
    await wait(400)
    const after = await page.evaluate(() => localStorage.getItem('ruby:muted'))
    record('sound toggle persists to localStorage', before !== after, `${before} -> ${after}`)

    await page.reload({ waitUntil: 'networkidle0' })
    await wait(2500)
    const persisted = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-pressed]')
      return btn?.getAttribute('aria-pressed')
    })
    record('mute state survives a reload', persisted === 'true', `aria-pressed=${persisted}`)
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-pressed]')
      btn?.click()
    })
    await wait(300)
  }

  const sayHello = await page.$('nav ~ * button, header button')
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const el = btns.find((b) => b.textContent.trim() === 'Say hello')
    el?.click()
  })
  await wait(900)
  const dialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    if (!d) return null
    const r = d.getBoundingClientRect()
    return { onScreen: r.left < window.innerWidth && r.right > 0, label: d.getAttribute('aria-label') }
  })
  record('contact drawer slides in', Boolean(dialog?.onScreen), dialog ? `label=${dialog.label}` : 'no dialog')
  void sayHello

  await page.screenshot({ path: resolve(OUT, 'i-drawer.png') })

  await page.keyboard.press('Escape')
  await wait(700)
  const closed = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    const r = d?.getBoundingClientRect()
    return r ? r.left >= window.innerWidth - 4 : false
  })
  record('Escape closes the drawer', closed)

  await page.close()
}

// --------------------------------------------------------------- burst test
{
  const page = await newPage(1440, 900)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const total = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  const contactTop = await page.evaluate(
    () => document.getElementById('stage-contact').getBoundingClientRect().top + window.scrollY,
  )
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), contactTop + 120)
  await wait(3000)

  // full viewport, no clip: the burst sprays across the whole centre of frame
  const before = await page.screenshot()
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.includes('Send it'),
    )
    btn?.click()
    return Boolean(btn)
  })
  record('contact CTA is present', clicked)
  await wait(550)
  const during = await page.screenshot()
  const burstDiff = await meanDiff(page, before, during)
  record('CTA fires the particle burst', burstDiff > 1, `mean pixel delta ${burstDiff.toFixed(2)}`)
  await page.screenshot({ path: resolve(OUT, 'i-burst.png') })
  void total
  await page.close()
}

// ------------------------------------------------------------ mobile layout
{
  const page = await newPage(390, 844)
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const total = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  record('no horizontal overflow on mobile', overflow <= 1, `${overflow}px`)

  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  })
  record(
    'WebGL canvas fills a mobile viewport',
    Boolean(canvas) && canvas.w === 390 && canvas.h === 844,
    canvas ? `${canvas.w}x${canvas.h}` : 'no canvas',
  )

  for (const [name, frac] of [['m1', 0.02], ['m2', 0.22], ['m3', 0.48], ['m4', 0.7], ['m5', 0.93]]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), total * frac)
    await wait(2600)
    await page.screenshot({ path: resolve(OUT, `${name}-mobile.png`) })
  }
  console.log('captured 5 mobile frames')
  await page.close()
}

await browser.close()

console.log('\n--- runtime problems ---')
if (problems.length === 0) console.log('none')
else [...new Set(problems)].forEach((p) => console.log(p))

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 && problems.length === 0 ? 0 : 1)
