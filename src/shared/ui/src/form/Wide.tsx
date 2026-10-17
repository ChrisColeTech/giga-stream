import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

/** A row with no label column — a paragraph, a chip strip, a list. `fill` lets a list inside take the group's remaining height. */
export function Wide({ children, className, fill = false }: { children: ReactNode; className?: string; fill?: boolean }) {
  return <div className={cn('min-w-0', fill && 'flex min-h-0 flex-1 flex-col', className)}>{children}</div>
}
