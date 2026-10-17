import type { ReactNode } from 'react'

import { cn } from '../lib/cn'

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
