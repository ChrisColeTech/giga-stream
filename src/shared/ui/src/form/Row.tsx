import type { ReactNode } from 'react'

import { cn } from '../lib/cn'
import { ACCENT, type Accent, FIELD_LABEL, FIELD_ROW } from './form-classes'
import { InfoTip } from './InfoTip'

/** One setting: label column left, the control right, trailing controls on the readout edge; an error under.
 *  `accent` draws the state bar in the page gutter beside the row (12px left of the label column, so no column moves). */
export function Row({
  label,
  tip,
  error,
  note,
  trailing,
  accent,
  disabled = false,
  children,
  align = 'center',
  className,
}: {
  label: string
  /** Explains the field in a real tooltip on an info glyph beside the label — never text under the control. */ tip?: string
  error?: string | null
  /** A readout under the control (a probe's answer, a resolved path) — muted, in the error line's place; an error wins. */ note?: string | null
  trailing?: ReactNode
  /** The row's state as the left-edge accent bar (§20.5) — never a dot. */ accent?: Accent
  disabled?: boolean
  children: ReactNode
  align?: 'center' | 'start'
  className?: string
}) {
  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      {accent !== undefined && accent !== 'none' && <span className={cn('absolute top-1 bottom-1 -left-3 w-1 rounded-full', ACCENT[accent])} aria-hidden />}
      <div className={cn(FIELD_ROW, align === 'start' && 'items-start')}>
        <span className={cn(FIELD_LABEL, align === 'start' && 'pt-2', disabled && 'opacity-45')}>
          <span className="truncate">{label}</span>
          {tip !== undefined && <InfoTip text={tip} label={label} />}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        {trailing !== undefined && <span className="flex flex-none items-center gap-1">{trailing}</span>}
      </div>
      {error !== undefined && error !== null && error !== '' ? (
        <p className="m-0 pl-[calc(var(--label-col,140px)+12px)] text-sm leading-5 text-st-failed" role="alert">
          {error}
        </p>
      ) : (
        note !== undefined &&
        note !== null &&
        note !== '' && <p className="m-0 truncate pl-[calc(var(--label-col,140px)+12px)] font-mono text-xs leading-5 text-muted">{note}</p>
      )}
    </div>
  )
}
