import { lazy, Suspense, useCallback, useState } from 'react'
import { Cursor } from './components/Cursor'
import { Nav } from './components/Nav'
import { ContactDrawer } from './components/ContactDrawer'
import { Grain, ScrollProgress, StageRail } from './components/Overlays'
import { Hero } from './stages/Hero'
import { About } from './stages/About'
import { Stack } from './stages/Stack'
import { Experience } from './stages/Experience'
import { Contact } from './stages/Contact'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { NAV } from './content/copy'
import { audio } from './lib/audio'


// three.js and its helpers are most of the bundle, so the WebGL layer loads
// after first paint. The DOM stages are fully usable while it streams in.
const Viewport = lazy(() => import('./gl/Viewport').then((m) => ({ default: m.Viewport })))

export default function App() {
  useSmoothScroll()
  const [burstKey, setBurstKey] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const fireBurst = useCallback(() => setBurstKey((k) => k + 1), [])
  // stable, because the drawer's open effect depends on onClose and would
  // otherwise re-run (re-grabbing focus, replaying the click) on every render
  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // first gesture anywhere unlocks the audio context
  const unlock = useCallback(() => audio.unlock(), [])

  return (
    <div onPointerDown={unlock} onKeyDown={unlock}>
      <a
        href="#stage-about"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-[#14091f]"
      >
        {NAV.skip}
      </a>

      <Suspense fallback={null}>
        <Viewport burstKey={burstKey} />
      </Suspense>
      <Grain />
      <ScrollProgress />
      <Cursor />
      <Nav onOpenContact={openDrawer} />
      <StageRail />

      {/* every stage is pointer-transparent except its own controls, so the
          3D layer underneath keeps receiving drags */}
      <main className="relative z-10 pointer-events-none">
        <Hero />
        <About />
        <Stack />
        <Experience />
        <Contact onBurst={fireBurst} onOpenDrawer={openDrawer} />
      </main>

      <ContactDrawer open={drawerOpen} onClose={closeDrawer} />
    </div>
  )
}
