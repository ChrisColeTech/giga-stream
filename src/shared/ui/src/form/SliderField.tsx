import { cn } from '../lib/cn'
import { FIELD_LABEL, FIELD_ROW } from './NumberField'
import { NumericInput } from './NumericInput'
import { RANGE } from './range-class'

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
