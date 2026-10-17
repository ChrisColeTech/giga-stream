import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

import { cn } from '../lib/cn'
import { FIELD } from './field-class'

/**
 * A REAL chevron, drawn as an icon beside the native select.
 *
 * The mockup draws it with `linear-gradient(45deg, …)`, which paints a single
 * diagonal stroke — it reads as a stray slash in the field's corner rather
 * than as a chevron, and it was the loudest "unfinished" tell on every rail.
 * An icon costs one element, recolours with the theme like everything else,
 * and is `pointer-events-none` so the whole control still opens the menu.
 */
export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block w-full">
      <select className={cn(FIELD, 'cursor-pointer appearance-none pr-7', className)} {...rest} />
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-faint" />
    </span>
  )
}
