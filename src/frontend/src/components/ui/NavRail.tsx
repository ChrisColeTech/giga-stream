import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@giga/ui/controls/Button'

/* THE left-pane navigation grammar (family ui/NavRail.tsx): a way back at
 * the top when the page is a drill-in, the item's name, then headed groups
 * of rows. One row style everywhere. SENSENOVA APPENDIX: an `action` slot in
 * the same top position (Setup's `Scan system`, the verb that fills the rows
 * beneath it), and `NavItem.count` accepts a node so a row can carry a
 * coloured state word. */
export const NAV_ROW =
  'flex h-8 w-full cursor-pointer items-center gap-2 border-0 border-l-2 border-l-transparent bg-transparent pr-2.5 pl-3 text-left ' +
  'font-sans text-[13px] text-muted transition-[background,border-color,color] duration-fade ease-linear hover:bg-hov hover:text-text ' +
  'focus-visible:outline-none data-selected:border-l-accent data-selected:bg-ctl data-selected:text-accent-text disabled:cursor-default disabled:opacity-40'

/** A group heading in the rail: Caption 12, sentence case. */
export const NAV_HEADING = 'px-3 pt-3 pb-1 text-xs leading-4 text-dim'

export function NavRail({
  back,
  action,
  children,
  ariaLabel,
}: {
  back?: { label: string; onClick: () => void }
  /** The verb that fills the list, in the way-back slot (Setup's `Scan system`). */
  action?: ReactNode
  children: ReactNode
  ariaLabel: string
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1.5" aria-label={ariaLabel}>
      {/* SENSENOVA DEVIATION (owner, 2026-09-12: "the left rail top button
          is still inconsistent"): the way-back is the ONE stock Button, full
          width, exactly like Setup's `Scan system` in the same slot — not the
          family's bare arrow row. */}
      {action !== undefined && <div className="px-2 pb-1.5">{action}</div>}
      {back !== undefined && (
        <div className="px-2 pb-1.5">
          <Button size="sm" full onClick={back.onClick}>
            <ArrowLeft aria-hidden />
            {back.label}
          </Button>
        </div>
      )}
      {children}
    </nav>
  )
}

export function NavGroup({ heading, children }: { heading?: string; children: ReactNode }) {
  return (
    <>
      {heading !== undefined && <div className={NAV_HEADING}>{heading}</div>}
      {children}
    </>
  )
}

export function NavItem({ selected, onClick, children, count, disabled, title }: { selected: boolean; onClick: () => void; children: ReactNode; count?: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={NAV_ROW} data-selected={selected ? '' : undefined} aria-current={selected ? 'page' : undefined} disabled={disabled} title={title} onClick={onClick}>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="font-mono text-xs tabular-nums text-dim">{count}</span>}
    </button>
  )
}
