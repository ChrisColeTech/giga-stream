import { ChevronDown, RotateCcw } from 'lucide-react'
import { animate, motion, type AnimationPlaybackControls } from 'framer-motion'
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { DUR_COLLAPSE_MS, EASE_P2P } from '@/constants/motion'
import { useReduceMotion } from '@/hooks/useReduceMotion'
import { cn } from '@/lib/cn'

/* THE ONLY COLLAPSIBLE PANEL BLOCK (doc 03 §Shared panel primitives). A
 * surface does not grow a private copy; the compose rail is the first consumer
 * and the Rig/Animate inspectors are next.
 *
 *
 * A REAL DISCLOSURE: a `<button>` with `aria-expanded` and `aria-controls`, so
 * Enter and Space work because the platform makes them work, and a screen
 * reader is told what the control opens. The chevron is a lucide icon, never a
 * punctuation glyph (hard rule 5).
 *
 * The body STAYS MOUNTED and toggles `display`. Unmounting it would drop the
 * children's own state — the Input section holds attached reference images —
 * and would leave `aria-controls` pointing at nothing while closed.
 *
 * IT IS AN ACCORDION, NOT A LONG PAGE (owner, 2026-08-06 — "they are not one
 * long scrollable panel"). Built against a capture of VS Code's own Explorer
 * sidebar rather than from memory, after two wrong attempts.
 *
 * What that reference actually does, and what this copies:
 *
 *   - The container NEVER scrolls. Every header is `flex-none` and therefore
 *     always on screen, however much is inside any section.
 *   - An OPEN section GROWS to fill the space — `flex: 1 1 auto`. In the
 *     reference a single open view (the file tree) occupies everything down to
 *     the collapsed headers; it does not stop at its content height and leave
 *     the panel half empty. That was the second attempt's mistake.
 *   - A CLOSED section is `flex-none`: its header row and nothing else, so
 *     collapsed ones stack up as a run of bars (`OUTLINE`, `TIMELINE` in the
 *     reference).
 *   - The body scrolls INSIDE its own share — `min-h-0 overflow-y-auto`. Two
 *     open sections each get a scrollbar; the rail still has none.
 *
 * Not copied, deliberately: VS Code puts ACTION ICONS in the header (new file,
 * refresh, collapse-all) and it lets you DRAG the boundary between two open
 * sections.
 * The drag is real work — it needs per-section sizes persisted, and
 * `useWorkspaceSplit` next door already owns that problem for panes — so it is
 * not built here. */

const HEADER =
  /* px-2.5, not px-3: at the 190px pane minimum a scrollbar leaves 179px of
     content, and those spare pixels per side are what keeps a long title off
     the chevron. `flex-1`, not `w-full`: the disclosure is one cell of the
     header ROW now, and the switch is the other. */
  'flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-ctl border-0 bg-transparent px-2.5 py-2 text-left ' +
  /* SENTENCE CASE (owner, 2026-08-06 — the Fluent standard: "use sentence
     casing for all UI text, including titles"). This row has now worn every
     casing this app has had: lowercase (doc 10 §4.3's railhead vocabulary),
     then UPPERCASE when the owner corrected it against VS Code's Explorer —
     and VS Code's caps are VS Code's convention, which breaks the Windows
     rule on purpose. The adopted standard is Microsoft's, so the header is a
     word, not a shout. What still separates a structural header from the mono
     parameter keys inside it: the sans face, the semibold weight, and the
     capital letter — which the keys, being literal identifiers, never get. */
  'text-[11px] font-semibold text-faint ' +
  'transition-colors duration-fade ease-linear hover:text-text active:text-faint ' +
  'focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)]'

const BODY = 'min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-2.5 pt-0.5 pb-3'

/** THE SECTION'S OWN ON/OFF, RIGHT-ALIGNED IN THE HEADER (owner, 2026-08-07).
 *
 *  It was the body's FIRST ROW — or, in the studio, a per-section apply button
 *  at the foot of it — which put the control that decides whether a stage
 *  happens at all in the same vocabulary as the knobs it governs, and hid it
 *  entirely when the section was collapsed. A stage's power switch is a
 *  property of the GROUP, so it rides the group's header: visible in the
 *  collapsed run of bars, and never mistaken for one of the settings beneath it.
 *
 *  It is a SIBLING of the disclosure button, not a child: a control inside a
 *  `<button>` is invalid HTML and its clicks would toggle the section on the
 *  way out. So the header is a row holding two controls, and the disclosure —
 *  which still owns `aria-expanded`/`aria-controls` — is merely the wide one. */
export interface SectionSwitch {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Inert with a reason, never hidden (hard rule 16). */
  disabled?: boolean
  /** Reports a state the job decides rather than accepting one. Full strength,
   *  not greyed — see `Toggle`. */
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
  /* NO `hug` (owner, 2026-08-07: *"the collapse isnt correct, its working
     completely different than the generate page"*). There WAS one — an open
     section taking its content height, `flex: 0 0 auto`, added when the studio
     inspector's six sections each carried a slider and an apply button and the
     growing default cut the pane into slivers.
​
     What removed the reason for it was moving each section's switch into its
     HEADER and its apply into the panel's footer: the bodies that were too tall
     to share a pane are now a field or two, so the growing model fits them the
     way it always fitted the compose rail. Keeping a second sizing mode meant
     two accordions that collapse differently in one app, which is what the
     owner was reading.
​
     It also fixed a bug neither surface should have had. A hugged section
     cannot SHRINK, so when the studio's bottom pane opened and took height
     away, the stack overflowed and the pane's `overflow-hidden` clipped
     whatever was last in the column — the Apply button. Growing sections yield
     that space to a `flex-none` footer as a matter of course, which is why the
     compose rail never hit it. */
  /** The stage switch, in the header. Sections that are always on have none. */
  control?: SectionSwitch
  /** Puts a `Restore defaults` button at the FOOT of the body. Omitted by
   *  sections that hold no settings — there is nothing to restore. */
  onRestoreDefaults?: () => void
  /** THE WHOLE GROUP IS INERT — its stage will not run on this job.
   *
   *  The ROWS already say so one at a time: each carries its own reason and
   *  greys itself. What this adds is the reading at a GLANCE — the title dims
   *  and the footer action goes with it, so a section that cannot do anything
   *  looks that way from the collapsed bar rather than only after opening it
   *  and inspecting seven separate controls.
   *
   *  The DISCLOSURE stays live on purpose. Reading what the stage would have
   *  used is still worth doing, and a header you cannot open is a control that
   *  hides information rather than one that refuses an action. */
  disabled?: boolean
  /** Why it is inert. A tooltip on the header, never prose on the panel (hard
   *  rule 18). */
  disabledReason?: string
}

/* NO `hint` (owner, 2026-08-06: "remove the labels on the right of the
 * headers"). Doc 03 §Shared panel primitives specifies one — "a right-aligned
 * summary that stays readable while collapsed" — and it was built, then read as
 * clutter twice: first as arithmetic nobody could decode (`4/6`), then as a
 * second row of words competing with the header it sits on. The reference this
 * accordion follows carries no summary either; it puts ACTIONS there.
 *
 * What was lost, deliberately: a collapsed group no longer says what is inside
 * it. The header alone has to earn it, which is an argument for few sections
 * with obvious names rather than for bringing the summary back. Doc 03 needs
 * amending to match. */

/* THE ANIMATION, AND WHY IT IS AN ABSOLUTE HEIGHT.
 *
 * The obvious value to animate is the one the LAYOUT already uses — `flex-grow`,
 * 1 open and 0 closed. It was tried and it does not move: grow distributes the
 * container's FREE space, so it is a RATIO, not a size. Two open sections
 * holding all the space between them are both at grow 1, and taking one of them
 * from 1 to 0 changes nothing at all until the very last instant, when the body
 * unmounts and the section teleports to its header. Measured on the real rail:
 *
 *     t=5ms 100px · t=54ms 225px · t=121ms 225px · t=185ms 33px
 *
 * — one jump, at the end, which is exactly the "very janky" this was meant to
 * fix. It is worse when a section is the ONLY open one: its share is 100% of
 * free space for every grow above zero, so there is no intermediate value to
 * animate through even in principle.
 *
 * So the section that is MOVING is taken out of the flex sizing for the length
 * of the animation — `flex: 0 0 <px>` — and its basis is animated between the
 * two heights flex itself would have chosen. Every OTHER section keeps its
 * resting `flex: 1 1 auto`, so they absorb or yield the space continuously and
 * every header below slides with it. That is the motion the accordion is for.
 *
 * The target is MEASURED, never guessed: the effect runs after React has
 * committed the new state, so the DOM is already at rest in it — read the
 * height, then put the section back where it started and animate to what was
 * read. A collapse measures its header; an expand measures the exact share flex
 * is about to give it, so handing control back at the end is a no-op rather
 * than a second jump.
 *
 * This is real layout every frame, not a transform, so nothing is scaled and no
 * text is distorted mid-flight — which is why it is not Framer's `layout` prop.
 *
 * IT IS IMPERATIVE ON PURPOSE. Three geometry properties, `display` and
 * `overflow` all have to change together, before paint, in an order React's
 * render cannot express — and the animation has to be able to read the resting
 * layout, which means it cannot be the thing describing it. */
const TWEEN = { duration: DUR_COLLAPSE_MS / 1000, ease: EASE_P2P } as const

export function Section({ title, open, onToggle, children, control, onRestoreDefaults, disabled = false, disabledReason }: SectionProps) {
  const bodyId = useId()
  const ref = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const running = useRef<AnimationPlaybackControls | null>(null)
  /* The height the section had at the instant it was pressed — captured BEFORE
     the state change, because after it the old geometry is gone. `null` means
     the open state moved without anyone pressing anything (a restored
     preference), and that must paint, not play. */
  const pressedAt = useRef<number | null>(null)
  const reduce = useReduceMotion()

  useLayoutEffect(() => {
    const el = ref.current
    const body = bodyRef.current
    if (el === null || body === null) return

    /* The resting geometry of whichever state we are now in. Inline, because
       this same function has to undo the animation's overrides at the end. */
    const rest = () => {
      el.style.flexGrow = open ? '1' : '0'
      el.style.flexShrink = open ? '1' : '0'
      el.style.flexBasis = 'auto'
      el.style.height = ''
      body.style.display = open ? 'flex' : 'none'
      body.style.overflow = ''
    }

    running.current?.stop()
    running.current = null

    const from = pressedAt.current
    pressedAt.current = null
    rest()
    /* Giga Stream delta (docs/23 section 3.1): the app's Reduce motion setting, which an imperative `animate()` does
       not see on its own, makes the fold paint at rest instead of play. */
    if (from === null || reduce) return

    const to = el.getBoundingClientRect().height
    /* Nothing to travel — a section pressed twice inside one frame, or one
       whose content is already the height of its header. */
    if (Math.abs(to - from) < 1) return

    /* Out of the flex sizing, back to where it was, and the body kept on
       screen: `display: none` at the START of a collapse would empty the
       section on frame one and leave nothing to slide shut. `overflow: hidden`
       for the same reason the section clips — a body briefly taller than its
       box would flash a scrollbar on every collapse (owner, 2026-08-06: "its
       adding a scroll bar when it collapses during the animation"). */
    el.style.flexGrow = '0'
    el.style.flexShrink = '0'
    el.style.flexBasis = `${from}px`
    body.style.display = 'flex'
    body.style.overflow = 'hidden'

    running.current = animate(from, to, {
      ...TWEEN,
      onUpdate: (height) => {
        el.style.flexBasis = `${height}px`
      },
      onComplete: rest,
    })
  }, [open, reduce])

  /* Stopping on unmount matters more than it looks: the callbacks above write
     to a detached element, and in dev a hot reload remounts mid-flight. */
  useLayoutEffect(() => () => running.current?.stop(), [])

  return (
    /* `overflow-hidden` so the body is CLIPPED by the section as it shrinks
       rather than spilling past the header below it. Geometry is deliberately
       absent from this class list — the effect owns it, and a Tailwind `flex-1`
       here would fight it every frame. */
    <section ref={ref} className="flex min-h-0 flex-col overflow-hidden border-b border-hair last:border-b-0">
      {/* `pr-2.5` on the ROW, so the switch lands on the same right margin the
          body's controls do and the two read as one column. The disclosure
          keeps its own left padding. */}
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
          {/* ONE icon that TURNS, rather than two icons swapped: the same object
              changing state reads as the control it is. */}
          <motion.span className="flex flex-none" initial={false} animate={{ rotate: open ? 0 : -90 }} transition={reduce ? { duration: 0 } : TWEEN}>
            <ChevronDown className="size-3 text-dim" aria-hidden />
          </motion.span>
          {/* The same 45% every disabled control in this app wears, so a dead
              section and a dead row are plainly the same state. */}
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
        {/* AT THE FOOT OF THE BODY, and inside the scroller on purpose.

            `mt-auto` puts it on the section's bottom edge while the group has
            room to spare — which is the usual state, since an open section
            GROWS to fill the rail — and lets it follow the last row when the
            content is taller than the space and the body scrolls. A footer
            pinned OUTSIDE the scroller would need its own overflow suppressed
            for the collapse animation, which is the scrollbar-flash bug this
            component already fixed once.

            Always live, never dirty-tracked: knowing whether a value differs
            from its default means holding a second copy of every default per
            stage, and the button costs nothing when nothing has moved. */}
        {onRestoreDefaults && (
          <div className="mt-auto flex flex-none pt-1.5">
            {/* Inert with the group: restoring the defaults of a stage that
                will not run is an action with no effect, and offering it would
                be the one live control on a dead panel. */}
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
