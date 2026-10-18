import { cn } from "../lib/cn";
import { lockedByMin, minReason } from "./chip-rules";
import { PILL_CHIP, PILL_FIELD_CHIP, PILL_FIELD_ROW, PILL_ROW } from "./pill-classes";

export interface ChipOption {
  readonly value: string;
  readonly label: string;
  readonly title?: string;
  readonly disabled?: boolean;
}

export interface ChipGroupProps {
  readonly options: ReadonlyArray<ChipOption>;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (value: string) => void;
  /** How many chips must stay on (default 0): the last `min` lit chips are locked, with `minText` as their title. */
  readonly min?: number;
  /** The locked chips' reason; the rule in a sentence unless a caller words it. */
  readonly minText?: string;
  /** The form's field size: 36px chips at the body size, equal, spanning the row (the same as `Segmented`'s). */
  readonly field?: boolean;
  readonly disabled?: boolean;
  readonly "aria-label": string;
  readonly className?: string;
}

/* ANY-OF, IN THE PILL VOCABULARY (`docs/28` section 4.3, Appendix A row 21): the chips are `Segmented`'s own flat pills,
 * each its own `aria-pressed` toggle, with no recessed track (the track is the nav's look and appears nowhere else). Where
 * a choice needs at least N, the last N lit chips are natively disabled with the rule as their title: disabled, never
 * hidden, and the reason rides the chip. */
export function ChipGroup({
  options,
  selected,
  onToggle,
  min = 0,
  minText,
  field = false,
  disabled = false,
  className,
  ...rest
}: ChipGroupProps) {
  return (
    <div role="group" className={cn(field ? PILL_FIELD_ROW : PILL_ROW, className)} {...rest}>
      {options.map((option) => {
        const on = selected.has(option.value);
        const locked = lockedByMin(on, selected.size, min);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            data-active={on ? "" : undefined}
            disabled={disabled || option.disabled === true || locked}
            title={locked ? (minText ?? minReason(min)) : option.title}
            className={cn(PILL_CHIP, field ? PILL_FIELD_CHIP : "h-7 px-3 text-xs")}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
