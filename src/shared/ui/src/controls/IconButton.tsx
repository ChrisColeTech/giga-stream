import type { ButtonHTMLAttributes } from 'react'

import { Tooltip } from '../form/Tooltip'
import { cn } from '../lib/cn'

const BASE =
  'inline-flex size-ctl-md items-center justify-center rounded-ctl border border-transparent ' +
  'bg-transparent p-0 text-muted cursor-pointer ' +
  'transition-[background,border-color,color,box-shadow] duration-fade ease-linear ' +
  'hover:bg-hov hover:text-text active:bg-hov active:text-faint ' +
  'disabled:pointer-events-none disabled:cursor-default disabled:opacity-30 disabled:shadow-none ' +
  /* The pressed state is a `data-on:` VARIANT, not an appended class list.
     `cn()` is a plain join with no conflict resolution, so `bg-accent-tint`
     sat in the same layer as the base `bg-transparent` and LOST to it on
     stylesheet order — the titlebar's pane toggles showed no pressed state at
     all. Variants are emitted after the base utilities, so they always win. */
  'data-on:border-accent-edge data-on:bg-accent-tint data-on:text-accent-text ' +
  'data-on:shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)] data-on:active:shadow-none'

/* `bordered` is the STANDALONE icon action — the seed dice and lock, the rail
 * refreshes — so it wears the same raised shape as `Button` rather than a flat
 * fill with an inset hairline (doc 11 §3). It was left behind when the buttons
 * were enhanced, which read as two different control systems on one rail: a
 * top-lit gradient from --ctl-hi down to --ctl, a soft drop, and a press that
 * REMOVES the shadow and flattens the fill so the control visibly sinks. */
const BORDERED =
  'border-ctl-edge text-text bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] ' +
  'shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] ' +
  'hover:border-dim hover:bg-[linear-gradient(180deg,var(--color-ctl-hov),var(--color-ctl-hi))] ' +
  'active:bg-[var(--color-ctl)] active:text-muted active:shadow-none'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Toggle-on state (a pane toggle whose pane is open, say). */
  on?: boolean
  /** Give the button the same fill and edge as a .btn — for standalone actions. */
  bordered?: boolean
  /** Why the button cannot be used now: natively `disabled`, in the focusable `Tooltip` labelled "Label. reason" (the
   *  `aria-label` is the label). Absent, no wrapper. A native `title` would double the bubble, so it is dropped. */
  reason?: string
}

export function IconButton({ on = false, bordered = false, reason, className, type = 'button', ...rest }: IconButtonProps) {
  const classes = cn(BASE, bordered && BORDERED, className)
  if (reason === undefined) return <button type={type} data-on={on ? '' : undefined} className={classes} {...rest} />
  return (
    <Tooltip text={reason} focusable label={`${rest['aria-label'] ?? 'Button'}. ${reason}`}>
      <button type={type} data-on={on ? '' : undefined} className={classes} {...rest} title={undefined} disabled />
    </Tooltip>
  )
}
