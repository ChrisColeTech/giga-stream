import { cn } from "@/lib/cn";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  /** Shown after the label in brackets, when given (the category select's counts). */
  readonly count?: number;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}

export interface SelectFieldProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  /** Why the field cannot be used right now: it rides on the control as its tooltip. */
  readonly reason?: string;
  readonly className?: string;
}

/** The one select of the interface: a 28 px field on the surface track, with its name for assistive technology. */
export function SelectField({ label, value, options, onChange, disabled = false, reason, className }: SelectFieldProps) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      title={reason}
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-ctl-sm w-full min-w-0 cursor-pointer rounded-ctl border border-ctl-edge bg-surface px-2 font-sans text-xs text-text",
        "transition-[border-color] duration-fade ease-linear hover:border-dim focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled} title={option.disabledReason}>
          {option.count !== undefined ? `${option.label} (${option.count})` : option.label}
        </option>
      ))}
    </select>
  );
}
