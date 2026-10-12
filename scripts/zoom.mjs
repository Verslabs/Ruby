// Zoomed capture of the stack stage so the 3D chips can be inspected closely.
//
// A plain viewport screenshot is taken (puppeteer's `clip` combined with
// captureBeyondViewport breaks position:fixed layers like the WebGL canvas),
// then cropped with an SVG viewBox wrapper rather than in the browser.
import puppeteer from 'puppeteer-core'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = resolve(ROOT, 'shots')
mkdirSync(SHOTS, { recursive: true })

// source region, in CSS pixels of the 1440x900 viewport
const REGION = { x: 520, y: 60, w: 840, h: 600 }

const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    {
      win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    }[process.platform] ||
    '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--hide-scrollbars'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto(process.env.URL || 'http://localhost:4173/', { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 3500))

const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'auto' }), total * 0.5)
await new Promise((r) => setTimeout(r, 3200))
console.log('scrollY:', await page.evaluate(() => window.scrollY), 'of', total)

const raw = resolve(SHOTS, 'zoom-raw.png')
await page.screenshot({ path: raw })
await browser.close()

// crop by wrapping the shot in an SVG whose viewBox is the region of interest
const href = 'file:///' + raw.replace(/\\/g, '/')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="900" height="${Math.round((900 * REGION.h) / REGION.w)}"
  viewBox="${REGION.x} ${REGION.y} ${REGION.w} ${REGION.h}">
  <image x="0" y="0" width="1440" height="900" xlink:href="${href}"/>
</svg>`
const wrapper = resolve(SHOTS, 'zoom-crop.svg')
writeFileSync(wrapper, svg)
console.log('wrote', wrapper)
