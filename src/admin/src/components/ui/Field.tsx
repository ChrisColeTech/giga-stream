import { ChevronDown } from 'lucide-react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

/* Focus adds a 2px accent-tinted RING, not just a border swap (doc 11 §3) —
 * a border colour change alone is easy to miss on a dark surface at 1px.
 * Disabled dims and says so, so a param row the model does not declare reads
 * disabled rather than merely inert (rule 16). */
const FIELD =
  'h-ctl-md w-full rounded-ctl border border-border bg-surface px-2 font-[inherit] text-[13px] text-text ' +
  'outline-none transition-[border-color,box-shadow] duration-fade ease-linear ' +
  'focus:border-accent focus:shadow-[0_0_0_2px_var(--color-accent-tint)] placeholder:text-dim ' +
  'disabled:cursor-not-allowed disabled:opacity-45'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...rest} />
}

/** A multi-line field on the same classes as `Input` (audit F11): a page never draws its own `<textarea>`. Height comes from `rows`. */
export function Textarea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(FIELD, 'h-auto resize-y py-2 leading-5', className)} {...rest} />
}

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
