import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@giga/ui/lib/cn'
import { NumericInput } from './NumericInput'
import { InfoTip } from './Tooltip'

/* THE form and workspace grammar (doc 03 §Frontend Rules — the page grammar;
 * the Banks index is the gold standard):
 *
 *   Workspace  the scrolling stage, FULL WIDTH with 24px of page padding —
 *              no centred column, no max width.
 *   Group      an icon tile (48px, the accent gradient), a mono Title 28
 *              heading, an optional badge and trailing action; groups are
 *              separated by the accent-cored splitter the Group draws itself.
 *   Row        a Body Strong (14/600) sentence-case label in a fixed column,
 *              ONE control spanning the row, trailing icon buttons on the
 *              readout edge, an error under the control. Explanation is a
 *              `tip` (an info glyph with a real tooltip) — never hint text.
 *   NumberRow  a number in a row, the unit inside the field.
 *   Wide       a row with no label column — a tile grid, a strip, a list.
 *   Actions    the form's end: ghost actions left, ONE accent button right.
 *
 * No cards, no boxes, no full-width dividers, nothing under 12px. */

/** Manrope semibold at 14px averages ~8px a character. Size the label column to the longest label a group renders, plus the info glyph. */
export function labelColumn(labels: readonly string[]): string {
  const longest = labels.reduce((widest, label) => Math.max(widest, label.length), 0)
  return `${Math.max(120, Math.ceil(longest * 8) + 36)}px`
}

/* THE ACCENT BAR (handoff §20.5, owner: "the green dots are lazy and low quality… they should be using the nano style
 * actionlist accent strips"): state on a row is a 4px rounded bar on its LEFT EDGE, never a dot. One ramp for the
 * ActionList's rows and a settings Row alike — the ActionList imports these classes; a Row takes `accent=`. */
export type Accent = 'none' | 'success' | 'error' | 'warning' | 'inactive'
export const ACCENT: Record<Accent, string> = {
  none: '',
  success: 'bg-st-done',
  error: 'bg-st-failed',
  warning: 'bg-sw-amber',
  inactive: 'bg-dim/40',
}

/* Label: Body Strong (14/600), sentence case, in the text font. Control: 36px, body 14, and it SPANS THE ROW — one width for every control in a form. */
export const FIELD_LABEL = 'flex w-[var(--label-col,140px)] flex-none items-center gap-1.5 text-sm leading-5 font-semibold text-text'
export const FIELD_ROW = 'flex items-center gap-3'
/* `!` because Input's own height/padding/size sit in the same layer and would win on order. */
export const FIELD_CONTROL = 'h-9! w-full min-w-0 flex-1 px-3! text-sm! leading-5'

/** The scrolling stage. `labels` sizes the label column for every row inside. `wide` is accepted and ignored — every workspace is full width now; it stays only for pages another wave still passes it from. */
export function Workspace({
  children,
  labels = [],
  className,
  fill = false,
}: {
  children: ReactNode
  labels?: readonly string[]
  className?: string
  wide?: boolean
  /** The last group's list takes the remaining height instead of the page scrolling (a settings pane whose body is one SplitList). */ fill?: boolean
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto bg-surface', fill && 'flex flex-col', className)}>
      <div
        className={cn('flex w-full flex-col px-6 pb-8', fill && 'min-h-0 flex-1 pb-6')}
        style={{ '--label-col': labelColumn(labels) } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}

/** A workspace group: icon tile, mono heading, optional badge, optional trailing action, rows; the splitter after it unless `last`.
 *
 *  THERE IS NO `hint` (removed 2026-09-06). A line under the heading is banned on every page, with no exceptions
 *  left: the Setup wizard's was revoked with the onboarding rewrite, and the Training page's five were migrated.
 *  The owner's reason, twice: the subtitles "are not very helpful, they just describe whats on the screen… they
 *  are just filler", and later, "i didnt ask for paragraphs". Explanation belongs in a Row's `tip`; state belongs
 *  in `badge`; a genuine legend the reader cannot infer belongs in the body as a `Wide` sentence. If you are
 *  reaching for a subtitle, you are describing the screen to someone already looking at it. */
export function Group({
  id,
  icon: Icon,
  title,
  badge,
  action,
  children,
  className,
  last = false,
  fill = false,
  collapsible = !fill,
}: {
  id?: string
  icon?: LucideIcon
  title: string
  badge?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  last?: boolean
  /** Take the remaining height; the last child (a SplitList without `height`) stretches to it. */ fill?: boolean
  /** The heading folds the group — ON for every group app-wide (owner, 2026-09-06: "fold this change into the next batch of fixes app-wide for the other pages"), off only for a `fill` group whose list owns the height. The tile and title toggle it; the chevron on the readout edge says which way until the fold affordance is redesigned (doc 03). */ collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)
  const shown = !collapsible || open
  const heading = (
    <>
      {Icon !== undefined && (
        <span className="grid size-12 flex-none place-items-center rounded-xl border border-accent-edge/40 bg-[linear-gradient(135deg,var(--color-accent-tint),transparent)] text-accent-text shadow-[var(--shadow-stroke-hi)]">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="m-0 font-mono text-[28px] leading-9 font-semibold text-text">{title}</h2>
          {badge !== undefined && <span className="rounded-ctl bg-ctl px-2 py-0.5 font-mono text-xs font-medium text-faint tabular-nums">{badge}</span>}
        </div>
      </div>
    </>
  )
  return (
    <section id={id} className={cn('flex flex-col gap-4 pt-5', fill && shown && 'min-h-0 flex-1', className)} aria-label={title}>
      <div className="flex items-center gap-3">
        {collapsible ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left focus-visible:outline-none"
            aria-expanded={open}
            title={open ? `Collapse ${title}` : `Expand ${title}`}
            onClick={() => setOpen((o) => !o)}
          >
            {heading}
          </button>
        ) : (
          heading
        )}
        {action !== undefined && <div className="flex flex-none items-center gap-2">{action}</div>}
        {collapsible && (
          <button
            type="button"
            className="grid size-8 flex-none cursor-pointer place-items-center rounded-ctl border-0 bg-transparent text-muted hover:bg-hov hover:text-text focus-visible:outline-none"
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            title={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={cn('size-4 transition-transform duration-200', !open && '-rotate-90')} aria-hidden />
          </button>
        )}
      </div>
      {shown && <div className={cn('flex flex-col gap-3', fill && 'min-h-0 flex-1')}>{children}</div>}
      {/* The section splitter: a faded rule with a soft accent core — visible on a near-black stage, unlike a bare hairline, and never a full-width bar. */}
      {!last && (
        <hr
          aria-hidden
          className="splitter mt-5 w-full border-0"
          style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, var(--color-dim) 22%, var(--color-accent) 50%, var(--color-dim) 78%, transparent 100%)',
            opacity: 0.6,
            boxShadow: '0 1px 14px 1px color-mix(in srgb, var(--color-accent) 20%, transparent)',
          }}
        />
      )}
    </section>
  )
}

/** One setting: label column left, the control right, trailing controls on the readout edge; an error under.
 *  `accent` draws the state bar in the page gutter beside the row (12px left of the label column, so no column moves). */
export function Row({
  label,
  tip,
  error,
  note,
  trailing,
  accent,
  disabled = false,
  children,
  align = 'center',
  className,
}: {
  label: string
  /** Explains the field in a real tooltip on an info glyph beside the label — never text under the control. */ tip?: string
  error?: string | null
  /** A readout under the control (a probe's answer, a resolved path) — muted, in the error line's place; an error wins. */ note?: string | null
  trailing?: ReactNode
  /** The row's state as the left-edge accent bar (§20.5) — never a dot. */ accent?: Accent
  disabled?: boolean
  children: ReactNode
  align?: 'center' | 'start'
  className?: string
}) {
  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      {accent !== undefined && accent !== 'none' && <span className={cn('absolute top-1 bottom-1 -left-3 w-1 rounded-full', ACCENT[accent])} aria-hidden />}
      <div className={cn(FIELD_ROW, align === 'start' && 'items-start')}>
        <span className={cn(FIELD_LABEL, align === 'start' && 'pt-2', disabled && 'opacity-45')}>
          <span className="truncate">{label}</span>
          {tip !== undefined && <InfoTip text={tip} label={label} />}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        {trailing !== undefined && <span className="flex flex-none items-center gap-1">{trailing}</span>}
      </div>
      {error !== undefined && error !== null && error !== '' ? (
        <p className="m-0 pl-[calc(var(--label-col,140px)+12px)] text-sm leading-5 text-st-failed" role="alert">
          {error}
        </p>
      ) : (
        note !== undefined &&
        note !== null &&
        note !== '' && <p className="m-0 truncate pl-[calc(var(--label-col,140px)+12px)] font-mono text-xs leading-5 text-muted">{note}</p>
      )}
    </div>
  )
}

/** A number in a row: the field spans the row like every other control; `unit` reads inside the field's right end. Arrow keys and the wheel step it; no spin buttons (the owner, 2026-09-05). */
export function NumberRow({
  label,
  tip,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  error,
}: {
  label: string
  tip?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  error?: string | null
}) {
  return (
    <Row label={label} tip={tip} error={error} disabled={disabled}>
      <span className="relative min-w-0 flex-1">
        <NumericInput
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          className={cn(FIELD_CONTROL, unit !== undefined && 'pr-44!')}
          onChange={onChange}
        />
        {unit !== undefined && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-faint">{unit}</span>}
      </span>
    </Row>
  )
}

/** A row with no label column — a paragraph, a chip strip, a list. `fill` lets a list inside take the group's remaining height. */
export function Wide({ children, className, fill = false }: { children: ReactNode; className?: string; fill?: boolean }) {
  return <div className={cn('min-w-0', fill && 'flex min-h-0 flex-1 flex-col', className)}>{children}</div>
}

/** The form's end: ghost actions left, the one filled accent right. */
/** `pinned` keeps the row against the bottom of a scrolling pane instead of sitting at the end of the content
 *  (owner, 2026-09-07: "you buried those action buttons at the bottom"). The overlays are where this matters —
 *  crop and the watermark remover already pin theirs outside the scroller, so a long step's verb is reachable
 *  without scrolling to find it. It cancels the workspace's own `px-6` so the bar spans the pane edge to edge. */
export function Actions({ left, children, className, pinned = false }: { left?: ReactNode; children: ReactNode; className?: string; pinned?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 pt-1', pinned && 'sticky bottom-0 z-10 -mx-6 mt-2 border-t border-hair bg-surface px-6 pt-2 pb-2', className)}>
      {left}
      <span className="flex-1" />
      {children}
    </div>
  )
}

export function Form({ className, children, onSubmit, ariaLabel }: { className?: string; children: ReactNode; onSubmit?: () => void; ariaLabel: string }) {
  return (
    <form
      aria-label={ariaLabel}
      className={cn('flex flex-col', className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
    >
      {children}
    </form>
  )
}

/** A tick that says a field's edit has been written — the settings panes' answer instead of a dirty banner (doc 06 §1a). Caption 12. */
export function SavedTick({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null
  return (
    <span
      className={cn('font-mono text-xs', state === 'saved' ? 'text-st-done' : state === 'error' ? 'text-st-failed' : 'animate-pulse-busy text-faint')}
      role="status"
      aria-live="polite"
    >
      {state === 'saved' ? '✓ saved' : state === 'error' ? 'could not save' : 'saving…'}
    </span>
  )
}
