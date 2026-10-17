import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { NumericInput } from './NumericInput'

/* A labelled row for a value that is SPECIFIED exactly — a seed, a face
 * budget, an octree depth (doc 03 §Shared panel primitives). A range control
 * does not help where the number is copied or reproduced; that case is
 * `SliderField`, and the two are not alternatives.
 *
 * THE LABEL COLUMN FLOOR IS 46px, NOT DOC 03's 52. The seed row is the
 * tightest case in the app — a 10-digit seed plus the dice and the lock inside
 * the 190px minimum rail — and at 52 the number clipped mid-digit, which makes
 * the one thing a seed is for (copying it) impossible. Doc 03's 52 was
 * measured against a different rail width.
 *
 * It is a FLOOR and not a fixed width, because a fixed 46 put `guidance` (53px
 * at 11px mono, measured) underneath its own control. A label that overlaps
 * the thing it names is worse than a seed that is 7px narrower, and a panel
 * that has no `guidance` row keeps the full 46. `labelColumn()` below sizes
 * the column to the longest label a panel actually renders, so every row in
 * that panel stays aligned and none of them overlaps. */

/** The width lives on `--label-col`, set once per panel by `labelColumn()`. */
export const FIELD_LABEL =
  /* `truncate` IS THE LOAD-BEARING PART (owner, 2026-08-07: *"the controls are
     overlapping the labels and each other"*).

     The width comes from `--label-col`, which `labelColumn()` sizes to the
     longest label in a panel — but only `ParamRows` ever set it. Every
     `SliderField` and `NumberField` rendered anywhere ELSE fell back to the
     46px default, and a `flex-none` box with no overflow rule does not clip:
     `strength` is 8 characters at 6.6px = 53px, so it spilled 7px into the
     slider beside it and the two drew on top of each other. Same for the
     studio's `width`/`height` rows.

     Sizing the var at every call site is the real fix and is done, but a
     primitive must not depend on every caller remembering — so it clips as
     well. A clipped label is a legible mistake; an overlapping one is not. */
  'w-[var(--label-col,46px)] flex-none truncate font-mono text-[11px] text-faint'

/** JetBrains Mono advances exactly 0.6em, so at 11px a character is 6.6px —
 *  this is a measurement, not a guess, and it matches the DOM to the pixel. */
export function labelColumn(labels: readonly string[]): string {
  const longest = labels.reduce((widest, label) => Math.max(widest, label.length), 0)
  return `${Math.max(46, Math.ceil(longest * 6.6))}px`
}
export const FIELD_ROW = 'flex items-center gap-1'
/** Matches the rail's other controls: `--h-sm`, tight padding, mono digits.
 *
 * THE `!`s ARE LOAD-BEARING. `Input` already carries `h-ctl-md`, `px-2` and
 * `text-[13px]`, and `cn()` is a plain join with no conflict resolution — two
 * utilities in the same layer are decided by stylesheet order, not by class
 * order, so this row's own three lost to the base every time. Every parameter
 * control was rendering at 13px in a 24px slot, and the cost landed on the
 * seed: at the 190px minimum rail a 10-digit seed clipped at 8 digits, which
 * makes the one thing a seed is for impossible. */
export const FIELD_CONTROL = 'h-ctl-sm! min-w-0 flex-1 px-1.5! font-mono text-[11px]!'

export interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** Rule 16: a disabled control stays visible and says why. */
  disabledReason?: string
  /** Trailing controls — the seed's dice and lock. */
  children?: ReactNode
}

export function NumberField({ label, value, onChange, min, max, step, disabled = false, disabledReason, children }: NumberFieldProps) {
  return (
    <div className={FIELD_ROW}>
      <span className={cn(FIELD_LABEL, disabled && 'opacity-45')}>{label}</span>
      <NumericInput
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        aria-label={label}
        className={FIELD_CONTROL}
      />
      {children && <span className="flex flex-none items-center gap-1">{children}</span>}
    </div>
  )
}
