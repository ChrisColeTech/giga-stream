import { cn } from "@/lib/cn";

export interface PillOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface PillChoiceProps<T extends string> {
  readonly label: string;
  readonly options: ReadonlyArray<PillOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
}

/** A ONE-OF CHOICE AS PILLS, the form's own control for a short closed set (Dark / Light / System): separate rounded
 *  pills, the chosen one tinted and ringed in the accent. A one-of group is a radio group, so the chosen pill is
 *  the one tab stop and the arrows move within it. */
export function PillChoice<T extends string>({ label, options, value, onChange, disabled = false }: PillChoiceProps<T>) {
  return (
    <span role="radiogroup" aria-label={label} className="inline-flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-ctl-sm cursor-pointer rounded-full border px-2.5 font-sans text-xs transition-[background,border-color,color] " +
                "duration-fade ease-linear disabled:cursor-not-allowed disabled:opacity-45",
              on
                ? "border-accent-edge bg-accent-tint text-accent-text"
                : "border-ctl-edge bg-transparent text-muted hover:bg-hov hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}
