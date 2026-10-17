import { cn } from '@/lib/cn'
import { FIELD_LABEL, FIELD_ROW } from './NumberField'
import { NumericInput } from './NumericInput'

/* A labelled row for a value that is EXPLORED within bounds — steps, guidance
 * (doc 03 §Shared panel primitives).
 *
 * Sliders and number entry are not alternatives: a bounded value gets BOTH, so
 * 4.5 guidance can be dragged OR typed. The readout is a real `NumericInput`,
 * not a label, which is the whole point — and it is why hard rule 19's
 * protection reaches this row too.
 *
 * The track is drawn from tokens: filled to the value in `--color-accent`,
 * empty in `--color-ctl`, with the same raised thumb the buttons wear
 * (`--shadow-ctl` + `--shadow-stroke-hi`). No hex, no rgb (hard rule 8). */

/** Exported for the rare control that is a slider ALONE — a density/zoom-like
 *  value where the number is noise (gallery thumbnail size). A parameter row
 *  keeps the full `SliderField`: label + track + typeable readout (rule 19). */
export const RANGE =
  'h-ctl-sm min-w-0 flex-1 cursor-pointer appearance-none bg-transparent outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-45 ' +
  '[&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full ' +
  '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,var(--color-accent)_var(--fill),var(--color-ctl)_var(--fill))] ' +
  '[&::-webkit-slider-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:size-[11px] [&::-webkit-slider-thumb]:appearance-none ' +
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ctl-edge ' +
  '[&::-webkit-slider-thumb]:bg-[linear-gradient(180deg,var(--color-ctl-hi),var(--color-ctl))] ' +
  '[&::-webkit-slider-thumb]:shadow-[var(--shadow-ctl),var(--shadow-stroke-hi)] ' +
  'focus-visible:[&::-webkit-slider-thumb]:border-accent ' +
  '[&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-ctl ' +
  '[&::-moz-range-progress]:h-[3px] [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-accent ' +
  '[&::-moz-range-thumb]:size-[11px] [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full ' +
  '[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ctl-edge [&::-moz-range-thumb]:bg-ctl'

/** The TRAILING COLUMN of a parameter row, exported so rows that are not
 *  sliders can end on the same edge — a LoRA slot's remove button sits in it,
 *  so its select and the scale track beneath line up on both sides instead of
 *  ending 30px apart.
 *
 *  Wide enough for `40000`, narrow enough to leave the 190px rail a track.
 *  The width lives on the WRAPPER: `Input` is `w-full` by design, so a width
 *  set on the control itself would be a second, losing opinion. */
export const READOUT_BOX = 'w-[54px] flex-none'
/** `!` for the same reason as `FIELD_CONTROL` — `Input`'s own height, padding
 *  and size sit in the same layer and win on stylesheet order otherwise. */
const READOUT = 'h-ctl-sm! px-1! text-center font-mono text-[11px]!'

export interface SliderFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  /** Rule 16: a disabled control stays visible and says why. */
  disabledReason?: string
}

export function SliderField({ label, value, onChange, min, max, step = 1, disabled = false, disabledReason }: SliderFieldProps) {
  const span = max - min
  const fill = span > 0 ? `${Math.min(100, Math.max(0, ((value - min) / span) * 100))}%` : '0%'

  return (
    <div className={FIELD_ROW} title={disabled ? disabledReason : undefined}>
      <span className={cn(FIELD_LABEL, disabled && 'opacity-45')}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        className={RANGE}
        style={{ '--fill': fill } as React.CSSProperties}
        /* A range only ever reports a valid number inside its bounds, so this
           is the one numeric read that may go straight to state. */
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className={READOUT_BOX}>
        <NumericInput value={value} onChange={onChange} min={min} max={max} step={step} disabled={disabled} aria-label={`${label} value`} className={READOUT} />
      </span>
    </div>
  )
}
