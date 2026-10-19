import { cn } from "../lib/cn";
import { Tooltip } from "../form/Tooltip";
import { lockedByMin, minReason } from "./chip-rules";
import { PILL_CHIP, PILL_ROW } from "./pill-classes";

export interface ChipOption {
  readonly value: string;
  readonly label: string;
  readonly title?: string;
  readonly disabled?: boolean;
}

export interface ChipGroupProps {
  /**
   * Legacy non-form chip toggles. Do not use for supplied form choices: supplied multi-choice uses a checklist.
   */
  readonly options: ReadonlyArray<ChipOption>;
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (value: string) => void;
  /** How many chips must stay on (default 0): the last `min` lit chips are locked with an accessible reason. */
  readonly min?: number;
  /** The locked chips' reason; the rule in a sentence unless a caller words it. */
  readonly minText?: string;
  readonly disabled?: boolean;
  readonly "aria-label": string;
  readonly className?: string;
}

/* Legacy any-of pills retained while its consumer migrates. A supplied form vocabulary is a checklist, never this
 * component. The last N lit chips remain native buttons and use the focusable disabled-reason wrapper. */
export function ChipGroup({
  options,
  selected,
  onToggle,
  min = 0,
  minText,
  disabled = false,
  className,
  ...rest
}: ChipGroupProps) {
  return (
    <div role="group" className={cn(PILL_ROW, className)} {...rest}>
      {options.map((option) => {
        const on = selected.has(option.value);
        const locked = lockedByMin(on, selected.size, min);
        const button = (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            data-active={on ? "" : undefined}
            disabled={disabled || option.disabled === true || locked}
            title={locked ? undefined : option.title}
            className={cn(PILL_CHIP, "h-7 px-3 text-xs")}
            onClick={() => onToggle(option.value)}
          >
            {option.label}
          </button>
        );
        if (!locked) return button;
        const reason = minText ?? minReason(min);
        return (
          <Tooltip key={option.value} text={reason} focusable label={`${option.label}. ${reason}`}>
            {button}
          </Tooltip>
        );
      })}
    </div>
  );
}
