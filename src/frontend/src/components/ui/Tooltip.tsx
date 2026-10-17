import { Info } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/* A REAL tooltip (doc 06 §1c): a styled bubble above its anchor on hover and
 * on keyboard focus, wired with aria-describedby, never the browser's yellow
 * box. `InfoTip` is the form's use: an info glyph beside a label that
 * explains the field — the replacement for hint paragraphs under controls.
 *
 * The bubble is PORTALED to the body and positioned from the anchor's
 * screen rect (owner, 2026-09-06: "the tooltips are being cutoff and
 * covered by page elements") — an absolutely positioned child is clipped by
 * every scrolling workspace and painted under any later stacking context;
 * a fixed element at the top layer is clipped by nothing. It flips below
 * the anchor when there is no room above, and stays inside the viewport
 * horizontally. */
const GAP = 8
const MAX_W = 320

type Pos = { left: number; top: number; below: boolean }

export function Tooltip({ text, children, className }: { text: string; children: ReactNode; className?: string }) {
  const id = useId()
  const anchor = useRef<HTMLSpanElement | null>(null)
  const bubble = useRef<HTMLSpanElement | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const a = anchor.current
    const b = bubble.current
    if (a === null || b === null) return
    const place = () => {
      const r = a.getBoundingClientRect()
      const w = b.offsetWidth
      const h = b.offsetHeight
      const below = r.top - h - GAP < 4
      const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)
      const top = below ? r.bottom + GAP : r.top - h - GAP
      setPos({ left, top, below })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, text])

  return (
    <span
      ref={anchor}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={id}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={bubble}
            id={id}
            role="tooltip"
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, maxWidth: MAX_W }}
            className={cn(
              'pointer-events-none fixed z-[80] w-max rounded-ctl border border-border bg-panel px-3 py-2 text-sm leading-5 text-text shadow-menu transition-opacity duration-fade ease-linear',
              pos === null ? 'opacity-0' : 'opacity-100',
            )}
          >
            {text}
            <span
              className={cn(
                'absolute left-1/2 -ml-1.5 size-3 rotate-45 border-border bg-panel',
                pos?.below === true ? 'bottom-full -mb-1.5 border-t border-l' : 'top-full -mt-1.5 border-r border-b',
              )}
              aria-hidden
            />
          </span>,
          document.body,
        )}
    </span>
  )
}

/** The info glyph beside a form label. */
export function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip text={text}>
      <button
        type="button"
        tabIndex={0}
        aria-label={`About ${label}`}
        className="grid size-5 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-dim hover:text-accent-text focus-visible:text-accent-text focus-visible:outline-none"
      >
        <Info className="size-4" aria-hidden />
      </button>
    </Tooltip>
  )
}
