import type { InputHTMLAttributes } from 'react'
import { useState } from 'react'

import { cn } from '../lib/cn'
import { Input } from '../controls/Input'

/* THE numeric entry control (doc 03 §Shared panel primitives). No surface
 * grows its own — a second copy is a second answer to the question below.
 *
 * Hard rule 19: a numeric input never emits NaN. Reading `event.target.value`
 * straight into state is what breaks it — an emptied `<input type="number">`
 * reports `""`, and `Number("") === 0`, so backspacing a seed silently commits
 * ZERO and the field can never be cleared to retype. So keystrokes are held
 * LOCALLY: the field may be empty or half-typed mid-edit, and only blur or
 * Enter commits a clamped number. Anything unparseable reverts to the last
 * committed value rather than shipping a number nobody typed.
 *
 * It is `type="text"` with a numeric `inputMode` for the same reason: a number
 * input hands back `""` for "1e", "-" and "1." too, so the browser's own
 * sanitisation is indistinguishable from a cleared field. Arrow-key stepping
 * is the one thing that costs us, so it is implemented below. */

const clamp = (value: number, min?: number, max?: number): number => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value))

/** Keeps 4.5 + 0.5 from landing on 4.999999999999999. */
const decimalsOf = (step: number): number => (String(step).split('.')[1] ?? '').length

type Passthrough = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'>

export interface NumericInputProps extends Passthrough {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export function NumericInput({ value, onChange, min, max, step = 1, className, ...rest }: NumericInputProps) {
  /** `null` means "showing the committed value"; a string means mid-edit. */
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft)
    setDraft(null)
    if (draft.trim() === '' || !Number.isFinite(parsed)) return
    const next = clamp(parsed, min, max)
    if (next !== value) onChange(next)
  }

  const nudge = (direction: 1 | -1) => {
    const base = draft === null || draft.trim() === '' ? value : Number(draft)
    if (!Number.isFinite(base)) return
    setDraft(null)
    const next = clamp(Number((base + direction * step).toFixed(decimalsOf(step))), min, max)
    if (next !== value) onChange(next)
  }

  return (
    <Input
      type="text"
      inputMode={decimalsOf(step) > 0 ? 'decimal' : 'numeric'}
      /* Announced as a spin button so the bounds and the current value are
         readable without seeing the row's label column. */
      role="spinbutton"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      value={draft ?? String(value)}
      className={cn('tabular-nums', className)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        } else if (event.key === 'Escape') {
          /* Abandon the edit. Not stopped: the shell may still want the key. */
          setDraft(null)
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          nudge(event.key === 'ArrowUp' ? 1 : -1)
        }
      }}
      {...rest}
    />
  )
}
