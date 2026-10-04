// Walks the built site in Chrome, screenshots every stage, and reports any
// console errors or failed requests. Run with: node scripts/check.mjs
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'shots')
const URL = process.env.URL || 'http://localhost:4173/'
const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--hide-scrollbars',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })

const problems = []
page.on('console', (msg) => {
  const type = msg.type()
  if (type === 'error' || type === 'warning') {
    problems.push(`[console.${type}] ${msg.text()}`)
  }
})
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`))
page.on('requestfailed', (req) =>
  problems.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText}`),
)
page.on('response', (res) => {
  if (res.status() >= 400) problems.push(`[http ${res.status()}] ${res.url()}`)
})

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })

// let the entrance animation and the GLB preloads finish
await new Promise((r) => setTimeout(r, 4000))

const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
console.log('scrollable px:', total)

// Read the real stage offsets rather than guessing them, so the captures land
// inside the stage they are named after.
const stages = await page.evaluate(() => {
  const ids = ['hero', 'about', 'stack', 'experience', 'contact']
  return ids.map((id) => {
    const el = document.getElementById(`stage-${id}`)
    return { id, top: el.getBoundingClientRect().top + window.scrollY, height: el.offsetHeight }
  })
})
console.log('stage geometry:', stages.map((s) => `${s.id}=${Math.round(s.top)}/${Math.round(s.height)}`).join(' '))

const marks = []
const pick = (id, frac, name) => {
  const s = stages.find((x) => x.id === id)
  marks.push({ name, at: (s.top + s.height * frac) / total })
}
pick('hero', 0.15, '01-hero')
pick('hero', 0.85, '02-hero-out')
pick('about', 0.15, '03-about-a')
pick('about', 0.45, '04-about-c')
pick('about', 0.85, '05-about-end')
pick('stack', 0.15, '06-stack-a')
pick('stack', 0.45, '07-stack-c')
pick('stack', 0.85, '08-stack-end')
pick('experience', 0.25, '09-experience-cards')
pick('experience', 0.75, '10-experience-repos')
pick('contact', 0.2, '11-contact')
pick('contact', 0.8, '12-contact-end')

for (const mark of marks) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), total * mark.at)
  // Lenis is smooth-scrolling, so give it time to land and the shaders to settle
  await new Promise((r) => setTimeout(r, 2600))
  await page.screenshot({ path: resolve(OUT, `${mark.name}.png`) })
  console.log('captured', mark.name, 'at', Math.round(mark.at * 100) + '%')
}

// frame timing under a forced scroll, to check the liquid pass is not the bottleneck
const fps = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 1200))
  let frames = 0
  const start = performance.now()
  return await new Promise((resolve) => {
    const tick = () => {
      frames++
      if (performance.now() - start < 3000) requestAnimationFrame(tick)
      else resolve(Math.round((frames / (performance.now() - start)) * 1000))
    }
    requestAnimationFrame(tick)
  })
})
console.log('swiftshader fps (software raster, not indicative of real GPU):', fps)

console.log('\n--- problems ---')
if (problems.length === 0) console.log('none')
else [...new Set(problems)].forEach((p) => console.log(p))

await browser.close()
