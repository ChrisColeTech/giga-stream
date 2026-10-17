import type { ReactNode } from 'react'

import { NAV_ROW } from './nav-classes'

/** One rail row: the selected row wears the accent edge; `count` sits on the right, in mono. */
export function NavItem({ selected, onClick, children, count, disabled, title }: { selected: boolean; onClick: () => void; children: ReactNode; count?: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button type="button" className={NAV_ROW} data-selected={selected ? '' : undefined} aria-current={selected ? 'page' : undefined} disabled={disabled} title={title} onClick={onClick}>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="font-mono text-xs tabular-nums text-dim">{count}</span>}
    </button>
  )
}
