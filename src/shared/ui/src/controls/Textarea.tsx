import type { TextareaHTMLAttributes } from 'react'

import { cn } from '../lib/cn'
import { FIELD } from './field-class'

/** A multi-line field on the same classes as `Input` (audit F11): a page never draws its own `<textarea>`. Height comes from `rows`. */
export function Textarea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(FIELD, 'h-auto resize-y py-2 leading-5', className)} {...rest} />
}
