import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/cn'

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

/* One button, four variants, three sizes — the whole vocabulary (doc 03 §2.1).
 * Uniform elevated shape: no ragged chips, no variant that is merely quieter. */
/* Raised, top-lit and pressable (doc 11 §3): the fill is a gradient running
 * from --ctl-hi down to --ctl, with an inset top hairline and a soft drop.
 * Pressing REMOVES the shadow and flattens the fill, so the control visibly
 * sinks — doc 06 §10's press feedback, which a colour swap alone does not give. */
const BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl border font-[550] ' +
  'cursor-pointer transition-[background,border-color,color,box-shadow] duration-fade ease-linear ' +
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none ' +
  /* A VARIANT, not an appended class: `cn()` is a plain join, so an appended
     `bg-accent-tint` shares a layer with the variant's own fill and loses to
     it on stylesheet order. Variants are emitted later and always win. */
  'data-on:border-accent-edge data-on:bg-accent-tint data-on:text-accent-text ' +
  'data-on:shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)] data-on:active:shadow-none'

/* Every size constrains its icon: lucide renders 24px by default, which
 * beside 13px text reads as a toolbar glyph, not a button's (owner, 2026-09-05). */
const SIZES: Record<ButtonSize, string> = {
  // sm = an action living INSIDE a list row. Smaller, never quieter.
  sm: 'h-ctl-sm px-2.25 gap-1 text-xs [&_svg]:size-3',
  md: 'h-ctl-md px-3 text-[13px] [&_svg]:size-3.5',
  lg: 'h-ctl-lg px-3.5 text-[13px] [&_svg]:size-4',
}

const RAISED = 'shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] active:shadow-none'

const VARIANTS: Record<ButtonVariant, string> = {
  default:
    'border-ctl-edge text-text bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] ' +
    RAISED +
    ' hover:border-dim hover:bg-[linear-gradient(180deg,var(--color-ctl-hov),var(--color-ctl-hi))] ' +
    'active:bg-[var(--color-ctl)] active:text-muted',
  primary:
    'border-accent text-accent-ink font-semibold ' +
    'bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent))] ' +
    'shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)] active:shadow-none ' +
    'hover:border-accent-strong hover:bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent-strong))] ' +
    'active:bg-[var(--color-accent)] active:text-[color-mix(in_srgb,var(--color-accent-ink)_75%,transparent)]',
  /* Ghost stays flat on purpose: it is navigation and dismissal only, and
     nothing behind it mutates state — raising it would overstate it. */
  ghost: 'border-transparent bg-transparent text-muted shadow-none ' + 'hover:bg-hov hover:text-text active:bg-hov active:text-faint',
  danger:
    'font-semibold text-st-failed border-[color-mix(in_srgb,var(--color-st-failed)_55%,transparent)] ' +
    'bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-st-failed)_24%,var(--color-ctl)),color-mix(in_srgb,var(--color-st-failed)_16%,var(--color-ctl)))] ' +
    RAISED +
    ' hover:border-st-failed hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-st-failed)_32%,var(--color-ctl)),color-mix(in_srgb,var(--color-st-failed)_24%,var(--color-ctl)))] ' +
    'active:bg-[color-mix(in_srgb,var(--color-st-failed)_16%,var(--color-ctl))]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  /** Toggle-on state — accent tint, matching an on icon-button. */
  on?: boolean
  /** Forwarded so a dialog can move focus to its committing button. React 19
   *  passes `ref` as a plain prop, so no forwardRef wrapper is needed. */
  ref?: React.Ref<HTMLButtonElement>
}

export function Button({ variant = 'default', size = 'md', full = false, on = false, className, type = 'button', ref, ...rest }: ButtonProps) {
  return (
    <button ref={ref} type={type} data-on={on ? '' : undefined} className={cn(BASE, SIZES[size], VARIANTS[variant], full && 'w-full', className)} {...rest} />
  )
}
