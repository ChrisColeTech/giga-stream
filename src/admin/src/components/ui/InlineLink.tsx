import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** A link-styled action inside a sentence (audit F32): Body 14, the accent, underlined on hover — one component, never a hand-drawn underline button. */
export function InlineLink({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn('cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-sm text-accent-text underline-offset-2 hover:underline', className)}
      {...rest}
    />
  )
}
