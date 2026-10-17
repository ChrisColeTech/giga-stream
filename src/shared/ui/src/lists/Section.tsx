import { ChevronDown, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { useId, useRef, type ReactNode } from 'react'

import { Button } from '../controls/Button'
import { Toggle } from '../controls/Toggle'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { FOLD_TWEEN, useSectionFold } from '../hooks/useSectionFold'
import { cn } from '../lib/cn'

/* THE ONLY COLLAPSIBLE PANEL BLOCK of the family (doc 03, shared panel primitives). A surface does not grow a private copy.
 *
 * A REAL DISCLOSURE: a `<button>` with `aria-expanded` and `aria-controls`, so Enter and Space work because the platform
 * makes them work. The chevron is a lucide icon, never a punctuation glyph.
 *
 * The body STAYS MOUNTED and toggles `display`: unmounting it would drop the children's own state and leave
 * `aria-controls` pointing at nothing while closed.
 *
 * AN ACCORDION, NOT A LONG PAGE (owner, 2026-08-06). The container never scrolls; every header is `flex-none`; an open
 * section GROWS to fill the space; a closed one is its header row; the body scrolls inside its own share. The fold itself
 * is `useSectionFold`. Not copied: VS Code's action icons in the header and a draggable boundary between open sections. */

const HEADER =
  /* px-2.5, not px-3: at the 190px pane minimum a scrollbar leaves 179px of content, and those spare pixels per side keep a
     long title off the chevron. `flex-1`: the disclosure is one cell of the header ROW, and the switch is the other. */
  'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-ctl border-0 bg-transparent px-2.5 py-2 text-left ' +
  /* SENTENCE CASE (owner, 2026-08-06: "use sentence casing for all UI text, including titles"). What separates a structural
     header from the mono parameter keys inside it is the sans face, the semibold weight and the capital letter. */
  'text-[11px] font-semibold text-faint ' +
  'transition-colors duration-fade ease-linear hover:text-text active:text-faint ' +
  'focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)]'

const BODY = 'min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-2.5 pt-0.5 pb-3'

/** The section's own on/off, right-aligned in the header (owner, 2026-08-07). A stage's power switch is a property of the
 *  group, so it rides the group's header: visible in the collapsed run of bars, never mistaken for a setting beneath it.
 *  It is a SIBLING of the disclosure button, not a child: a control inside a `<button>` is invalid HTML. */
export interface SectionSwitch {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Inert with a reason, never hidden. */
  disabled?: boolean
  /** Reports a state the job decides rather than accepting one. Full strength, not greyed. */
  readOnly?: boolean
  /** Why it is inert, or what it does. A tooltip, never prose on the panel. */
  title?: string
  'aria-label': string
}

export interface SectionProps {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  /** The on/off switch, in the header. Sections that are always on have none. */
  control?: SectionSwitch
  /** Puts a `Restore defaults` button at the FOOT of the body. Omitted by sections that hold no settings. */
  onRestoreDefaults?: () => void
  /** THE WHOLE GROUP IS INERT. The title dims and the footer action goes with it, so a dead section reads as dead from the
   *  collapsed bar. The DISCLOSURE stays live: reading what would have been used is still worth doing. */
  disabled?: boolean
  /** Why it is inert. A tooltip on the header, never prose on the panel. */
  disabledReason?: string
}

export function Section({ title, open, onToggle, children, control, onRestoreDefaults, disabled = false, disabledReason }: SectionProps) {
  const bodyId = useId()
  const ref = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  /* The height at the instant the header was pressed, read BEFORE the state changes (after it the old geometry is gone). */
  const pressedAt = useRef<number | null>(null)
  const reduce = useReduceMotion()
  useSectionFold(ref, bodyRef, open, pressedAt)

  return (
    /* `overflow-hidden` so the body is CLIPPED as the section shrinks. Geometry is absent from this class list on purpose:
       the fold owns it, and a Tailwind `flex-1` here would fight it every frame. */
    <section ref={ref} className="flex min-h-0 flex-col overflow-hidden border-b border-hair last:border-b-0">
      {/* `pr-2.5` on the row, so the switch lands on the same right margin as the body's controls. */}
      <div className="flex flex-none items-center gap-1.5 pr-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            pressedAt.current = ref.current?.getBoundingClientRect().height ?? null
            onToggle()
          }}
          className={HEADER}
          title={disabled ? disabledReason : undefined}
        >
          {/* ONE icon that TURNS, rather than two icons swapped. */}
          <motion.span className="flex flex-none" initial={false} animate={{ rotate: open ? 0 : -90 }} transition={reduce ? { duration: 0 } : FOLD_TWEEN}>
            <ChevronDown className="size-3 text-dim" aria-hidden />
          </motion.span>
          <span className={cn('flex-none', disabled && 'opacity-45')}>{title}</span>
        </button>
        {control && (
          <Toggle
            className="flex-none"
            checked={control.checked}
            disabled={control.disabled ?? false}
            readOnly={control.readOnly ?? false}
            title={control.title}
            aria-label={control['aria-label']}
            onChange={control.onChange}
          />
        )}
      </div>
      <div id={bodyId} ref={bodyRef} className={BODY}>
        {children}
        {/* AT THE FOOT OF THE BODY, inside the scroller: `mt-auto` holds it on the bottom edge while there is room, and it
            follows the last row when the body scrolls. Always live, never dirty-tracked. */}
        {onRestoreDefaults && (
          <div className="mt-auto flex flex-none pt-1.5">
            {/* Inert with the group: restoring the defaults of a stage that will not run is an action with no effect. */}
            <Button
              size="sm"
              full
              disabled={disabled}
              title={disabled ? disabledReason : `Restore ${title.toLowerCase()} settings to their defaults`}
              onClick={onRestoreDefaults}
            >
              <RotateCcw aria-hidden />
              Restore defaults
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
