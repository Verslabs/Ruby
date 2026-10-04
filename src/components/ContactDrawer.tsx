import { useEffect, useRef } from 'react'
import { ArrowUpRight, Mail, X } from 'lucide-react'
import { GithubMark } from './GithubMark'
import { CONTACT, DRAWER } from '../content/copy'
import { audio } from '../lib/audio'

const LINKS = [
  { handle: 'KitKatsDevelopment', href: 'https://github.com/KitKatsDevelopment' },
  { handle: 'CollaredKittyCat', href: 'https://github.com/CollaredKittyCat' },
  { handle: 'ZenomoStudio', href: 'https://github.com/ZenomoStudio' },
]

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Contact drawer. Slides in from the right, traps nothing clever, but does
 * close on Escape, on backdrop click, and returns focus where it came from.
 */
export function ContactDrawer({ open, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreFocus.current = document.activeElement as HTMLElement
    panel.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    audio.play('click')

    return () => {
      document.removeEventListener('keydown', onKey)
      restoreFocus.current?.focus()
    }
  }, [open, onClose])

  return (
    <div
      className={`fixed inset-0 z-[80] transition-[visibility] ${open ? 'visible' : 'invisible'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={DRAWER.close}
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 backdrop-blur-sm transition-opacity duration-500 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={DRAWER.title}
        tabIndex={-1}
        className={`absolute right-0 top-0 flex h-full w-full max-w-[26rem] flex-col gap-8 border-l border-white/12 bg-[#120a20]/92 p-8 backdrop-blur-2xl outline-none transition-transform duration-[650ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="display grad-text text-[clamp(1.9rem,5vw,2.6rem)]">{DRAWER.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto rounded-full border border-white/15 p-2 text-white/70 transition-colors hover:border-white/40 hover:text-white"
            aria-label={DRAWER.close}
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        <p className="text-[0.95rem] leading-relaxed text-white/70">{DRAWER.body}</p>

        <a
          href={`mailto:${CONTACT.email}`}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-4 transition-colors duration-500 hover:border-white/28 hover:bg-white/[0.09]"
          onClick={() => audio.play('click')}
        >
          <Mail className="h-4 w-4 shrink-0 text-white/55" strokeWidth={1.6} />
          <span className="text-[0.95rem] text-white/90">{CONTACT.email}</span>
        </a>

        <div>
          <p className="eyebrow mb-4">{DRAWER.githubLabel}</p>
          <ul className="space-y-2">
            {LINKS.map((link) => (
              <li key={link.handle}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="pointer-events-auto group flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-500 hover:bg-white/[0.07]"
                  onClick={() => audio.play('click')}
                >
                  <GithubMark className="h-4 w-4 shrink-0 text-white/50" />
                  <span className="text-[0.92rem] text-white/85">{link.handle}</span>
                  <ArrowUpRight
                    className="ml-auto h-4 w-4 shrink-0 text-white/35 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    strokeWidth={1.6}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
