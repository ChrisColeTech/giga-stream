import { cn } from '../lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Rendered before the label — an icon, usually. */
  icon?: React.ReactNode
  /** A choice this state of the world cannot serve. It stays in the row,
   *  dimmed and unpressable, WITH ITS REASON in `disabledReason` — hard rule
   *  16: disabled, never hidden. A chip that vanishes takes its own
   *  explanation with it and moves everything beside it. */
  disabled?: boolean
  /** Why it cannot be picked. Required in practice whenever `disabled` is set:
   *  an inert control with no reason is exactly what rule 16 forbids. */
  disabledReason?: string
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  'aria-label'?: string
  /** Shorter chips, for a 30px bar. */
  dense?: boolean
  /** Every chip the width of the widest (owner, 2026-09-05: labels with counts made the chips "all different widths"). */
  equal?: boolean
  /** The form's field size (docs/27 step 2a): 36px chips at the body size, equal segments spanning the row, for a one-of
   *  choice in a labelled form row. Same pills; only the size and the span differ. */
  field?: boolean
  className?: string
}

/* PILL CHIPS, ONE LIT (owner's pick, 2026-09-05 night — docs/handoff/
 * SEGMENTED-ALTERNATIVES.md candidate A): the recessed track with raised
 * segments is the NAV's look (PageTabs) and must not appear anywhere else in
 * the app. A one-of choice on a page is a row of flat pills with no track:
 * off = hairline edge, muted text; on = the accent tint and edge the buttons
 * use for `data-on`, so a lit chip reads like a pressed toggle button
 * anywhere else. Counts ride inside the chip's label. `equal` sizes every
 * chip to the widest so a row never re-flows as counts change. */
const ROW = 'inline-flex flex-none flex-wrap items-center gap-1.5'
const EQUAL_ROW = 'inline-grid auto-cols-fr grid-flow-col gap-1.5'
/** The field size spans the row: equal segments that take the row's full width. */
const FIELD_ROW = 'grid w-full min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5'
const FIELD_CHIP = 'h-9 px-3 text-sm'

const CHIP =
  'inline-flex min-w-0 cursor-pointer items-center justify-center gap-1.25 rounded-full border border-ctl-edge ' +
  'bg-transparent whitespace-nowrap text-muted transition-[background,color,border-color] duration-fade ease-linear ' +
  'hover:bg-hov hover:text-text ' +
  'data-active:border-accent-edge data-active:bg-accent-tint data-active:font-semibold data-active:text-accent-text ' +
  'disabled:cursor-not-allowed disabled:text-dim disabled:hover:bg-transparent disabled:hover:text-dim'

/** Chips share a rail's full width equally — never ragged. */
export const SEG_FULL = 'flex [&>button]:flex-1 [&>button]:justify-center'

/** A one-of control: one home for a small closed set of choices. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  dense = false,
  equal = false,
  field = false,
  className,
  ...rest
}: SegmentedProps<T>) {
  const row = field ? FIELD_ROW : equal ? EQUAL_ROW : ROW
  const size = field ? FIELD_CHIP : dense ? 'h-6 px-2.5 text-xs' : 'h-7 px-3 text-xs'
  return (
    <div role="group" className={cn(row, className)} {...rest}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          data-active={option.value === value ? '' : undefined}
          disabled={option.disabled}
          title={option.disabled ? option.disabledReason : undefined}
          className={cn(CHIP, size)}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
