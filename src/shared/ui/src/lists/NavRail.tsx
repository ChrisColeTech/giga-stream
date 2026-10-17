import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../controls/Button'

/* THE left-pane navigation grammar (family ui/NavRail.tsx): a way back at
 * the top when the page is a drill-in, the item's name, then headed groups
 * of rows. One row style everywhere. SENSENOVA APPENDIX: an `action` slot in
 * the same top position (Setup's `Scan system`, the verb that fills the rows
 * beneath it), and `NavItem.count` accepts a node so a row can carry a
 * coloured state word. Its parts: NavGroup (a heading) and NavItem (a row). */

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
