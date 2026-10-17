import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '../lib/cn'

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
