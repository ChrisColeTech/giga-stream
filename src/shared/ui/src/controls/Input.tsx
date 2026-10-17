import type { InputHTMLAttributes } from 'react'

import { cn } from '../lib/cn'
import { FIELD } from './field-class'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...rest} />
}
