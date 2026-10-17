import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

/** The form's end: ghost actions left, the one filled accent right. */
/** `pinned` makes the row a fixed strip to be placed OUTSIDE the scroller, directly above a `Workspace` (owner,
 *  2026-09-07: "you buried those action buttons at the bottom"; 2026-10-17: Title information's strip moves from the
 *  foot to the top). It carries the workspace's own `px-6` and a hairline under it, so the body scrolls beneath it. */
export function Actions({ left, children, className, pinned = false }: { left?: ReactNode; children: ReactNode; className?: string; pinned?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 pt-1', pinned && 'flex-none border-b border-hair bg-surface px-6 pt-2 pb-2', className)}>
      {left}
      <span className="flex-1" />
      {children}
    </div>
  )
}
