import { Tooltip } from '../form/Tooltip'
import { cn } from '../lib/cn'
import { PILL_CHIP, PILL_EQUAL_ROW, PILL_SEGMENTED_ROW } from './pill-classes'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Rendered before the label — an icon, usually. */
  icon?: React.ReactNode
  /** A peer mode this state of the world cannot serve. It stays in the pair, dimmed and unpressable. */
  disabled?: boolean
  /** Why it cannot be picked. With `disabled`, this puts the native button in a focusable tooltip wrapper. */
  disabledReason?: string
}

interface SegmentedProps<T extends string> {
  /**
   * Exactly two fixed, short peer modes. Neither is a catch-all, dynamic value, boolean state, navigation or verb.
   * The array remains open for temporary source compatibility; repository inventory tests enforce the pair rule.
   */
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  'aria-label'?: string
  /** Shorter chips, for a 30px bar. */
  dense?: boolean
  /** Every chip the width of the widest (owner, 2026-09-05: labels with counts made the chips "all different widths"). */
  equal?: boolean
  className?: string
}

/* PILL CHIPS, ONE LIT (owner's pick, 2026-09-05 night — docs/handoff/
 * SEGMENTED-ALTERNATIVES.md candidate A): the recessed track with raised
 * segments is the NAV's look (PageTabs) and must not appear anywhere else in
 * the app. A binary peer-mode choice on a page is a row of flat pills with no track:
 * off = hairline edge, muted text; on = the accent tint and edge the buttons
 * use for `data-on`, so a lit chip reads like a pressed toggle button
 * anywhere else. `equal` sizes both pills to the widest label. */
const ROW = PILL_SEGMENTED_ROW
const EQUAL_ROW = PILL_EQUAL_ROW
const CHIP = PILL_CHIP

/** Chips share a rail's full width equally — never ragged. */
export const SEG_FULL =
  'flex [&>button]:flex-1 [&>button]:justify-center [&>span]:flex-1 [&>span>button]:w-full'

/** A binary one-of control for direct, one-click comparison between two fixed peer modes. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  dense = false,
  equal = false,
  className,
  ...rest
}: SegmentedProps<T>) {
  const row = equal ? EQUAL_ROW : ROW
  const size = dense ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-xs'
  return (
    <div role="group" className={cn(row, className)} {...rest}>
      {options.map((option) => {
        const button = (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            data-active={option.value === value ? '' : undefined}
            disabled={option.disabled}
            className={cn(CHIP, size)}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {option.label}
          </button>
        )
        if (option.disabled !== true || option.disabledReason === undefined) return button
        return (
          <Tooltip
            key={option.value}
            text={option.disabledReason}
            focusable
            label={`${option.label}. ${option.disabledReason}`}
            className="min-w-0 [&>button]:w-full"
          >
            {button}
          </Tooltip>
        )
      })}
    </div>
  )
}
