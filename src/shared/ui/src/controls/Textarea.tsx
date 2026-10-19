import type { TextareaHTMLAttributes } from 'react'

import { cn } from '../lib/cn'
import { FIELD_BASE } from './field-class'

/** A multi-line field on the field classes minus the height (audit F11): a page never draws its own `<textarea>`.
 * Height comes from `rows` — never from `FIELD`, whose `h-ctl-md` wins the generated stylesheet's cascade over
 * `h-auto` and squashes the field to one line (doc 53 §2.1). */
export function Textarea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(FIELD_BASE, 'h-auto resize-y py-2 leading-5', className)} {...rest} />
}
