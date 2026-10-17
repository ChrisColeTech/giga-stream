import { cn } from '../lib/cn'

/* A MULTI-SELECT in the segmented vocabulary (giga-images merge-ui, verbatim):
 * the same recessed track and raised, accent-text chips as `Segmented`, but
 * each chip is its own aria-pressed toggle. Segmented is for one-of; this is
 * for any-of — presets, aspects, resolution buckets (doc 06 §1b). */
export interface ChipOption {
  value: string
  label: string
  title?: string
  disabled?: boolean
}

export interface ChipGroupProps {
  options: ReadonlyArray<ChipOption>
  selected: ReadonlySet<string>
  onToggle: (value: string) => void
  disabled?: boolean
  'aria-label': string
  className?: string
}

const TRACK = 'inline-flex flex-wrap gap-0.5 rounded-ctl border border-ctl-edge bg-surface p-0.5'
const CHIP =
  'inline-flex h-[30px] cursor-pointer items-center justify-center rounded-[1px] border-0 bg-transparent px-3 ' +
  'text-sm whitespace-nowrap text-muted transition-[background,color,box-shadow] duration-fade ease-linear hover:text-text ' +
  'disabled:cursor-not-allowed disabled:text-dim disabled:hover:text-dim ' +
  'data-active:bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] data-active:font-semibold data-active:text-accent-text ' +
  'data-active:shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)]'

export function ChipGroup({ options, selected, onToggle, disabled = false, className, ...rest }: ChipGroupProps) {
  return (
    <div role="group" className={cn(TRACK, className)} {...rest}>
      {options.map((option) => {
        const on = selected.has(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            data-active={on ? '' : undefined}
            disabled={disabled || option.disabled}
            title={option.title}
            className={CHIP}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
