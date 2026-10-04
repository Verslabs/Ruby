# Ruby — Portfolio

A single-page interactive portfolio built as a pinned, stage-based scroll. There
is no native vertical scroll: each stage pins itself to the viewport while a
WebGL layer runs continuously behind and through it. Stages are Hero, About,
Stack, Experience, and Contact.

Everything visual is generated, not sourced. The organic 3D shapes and language
badges are modelled in Blender and exported as glTF, the icons are drawn as
vectors and exported with Inkscape, and the audio is synthesised from scratch.
The only third-party imagery in the repo is what those pipelines produced.

## Stack

Vite 8, React 19, TypeScript, Tailwind v4 (`@tailwindcss/vite`), three.js with
`@react-three/fiber` and `@react-three/drei`, GSAP, Lenis for smooth scroll, and
Howler for audio.

## Setup

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run preview    # serves dist on http://localhost:4173
npm run lint       # oxlint
```

`npm run build` runs the TypeScript project build first, so type errors fail the
build rather than only surfacing in the editor. The 3D viewport is lazy-loaded,
which keeps the main bundle near 428 kB and moves roughly 1 MB of three.js and
drei into a separate chunk that arrives after first paint.

## How it fits together

`src/App.tsx` owns the document: one scroll container, the stage components, and
the overlay chrome. Each stage measures itself into `src/lib/stageRanges.ts`, and
`useSmoothScroll` keeps Lenis and a ScrollTrigger aligned so the shared
scroll position is the single source of truth for both DOM and WebGL.

The 3D layer lives in `src/gl/Viewport.tsx` as a single persistent `<Canvas>`.
It is never remounted across stages, which is what lets shapes keep their
physics state while the copy above them changes. Objects that belong to a stage
that is not on screen are hidden, and hidden objects are also made
non-raycastable: three.js ignores the `visible` flag when building its raycast
list, so a shape that is merely invisible will still swallow pointer events.
`setPickable()` in `DraggableShape.tsx` and `BadgeChip.tsx` swaps `raycast` for a
no-op to prevent that. The spring integration runs every frame regardless of
visibility, because skipping it while hidden leaves a shape frozen mid-flight
when it comes back.

Stage colour comes from `src/lib/palettes.ts`. Five palettes are sampled
against scroll progress and the result is written to `--stage-bg`, so the CSS
background and the three.js scene colour move together. The backdrop is a GLSL
sine-wave ribbon field in `src/shaders/waveRibbons.ts`, put through a liquid
distortion pass in `src/shaders/liquidDistortion.ts`.

Copy is collected in `src/content/copy.ts` and nowhere else, which makes it the
single place to review every visitor-facing string.

## Asset pipeline

Regenerating assets is optional: they are committed under `public/`. Each step
below is how the current files were produced.

**Audio.** `node scripts/make-audio.mjs` synthesises the four WAV files in
`public/audio/` (ambient bed, click, hover, transition) and writes them
directly. The ambient loop is built so the end of the buffer meets the start,
which you can confirm by diffing the first and last samples of the file.

**3D shapes and badges.** Modelled in Blender and exported as glTF into
`public/assets/3d/`. glTF is Y-up, so meshes authored lying flat come in
standing up; badge meshes are wrapped in a group rotated by 90° on X to
compensate. Badges are built at 1.50 × 1.50 × 0.30 with a bevelled, pillow-
displaced top so the logo plane reads as a soft chip rather than a flat plate.

**Vectors.** Icons are drawn as SVG and exported to `public/assets/vectors/`
with the Inkscape CLI, at both 1× and 2× where a raster fallback is useful.

## Verification

Both scripts drive the built site in Chrome through `puppeteer-core`, so run
`npm run build && npm run preview` first and leave the preview server up. Point
them at another origin with `URL`, and at a different Chrome with `CHROME_PATH`.

```bash
node scripts/check.mjs      # 12 stage captures, console + network problems
node scripts/interact.mjs   # 16 interaction checks
node scripts/zoom.mjs       # close crop of the stack stage, for badge inspection
```

`check.mjs` scrolls the whole page, captures each stage, and fails on any
console error, page error, or failed request. `interact.mjs` exercises the real
input path: it drags a hero shape and confirms it keeps moving after release and
springs back toward its origin, toggles sound and reloads to confirm the mute
state persists in `localStorage`, opens and escapes the contact drawer, fires
the particle burst, and checks mobile layout for horizontal overflow and canvas
size. Screenshots land in `shots/`.

Two notes on how `interact.mjs` measures. Comparison is done with a `meanDiff`
pixel helper that is calibrated at runtime against a self-diff, so a near-zero
baseline is proven per run rather than assumed. It also hides the grain and
cursor overlay layers before sampling, since those animate continuously and
would otherwise register as motion no matter what happened underneath. Puppeteer's
screenshot `clip` is document-relative rather than viewport-relative, which is
worth remembering when reading the region maths in that file.

The fps number that `check.mjs` prints comes from a software rasteriser in
headless Chrome. It is a smoke test for gross regressions, not a measurement of
real GPU performance.