import { cn } from '../lib/cn'
import { FIELD_CONTROL } from './form-classes'
import { NumericInput } from './NumericInput'
import { Row } from './Row'

/** A number in a row: the field spans the row like every other control; `unit` reads inside the field's right end. Arrow keys and the wheel step it; no spin buttons (the owner, 2026-09-05). */
export function NumberRow({
  label,
  tip,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  error,
}: {
  label: string
  tip?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
  error?: string | null
}) {
  return (
    <Row label={label} tip={tip} error={error} disabled={disabled}>
      <span className="relative min-w-0 flex-1">
        <NumericInput
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={label}
          className={cn(FIELD_CONTROL, unit !== undefined && 'pr-44!')}
          onChange={onChange}
        />
        {unit !== undefined && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-faint">{unit}</span>}
      </span>
    </Row>
  )
}
