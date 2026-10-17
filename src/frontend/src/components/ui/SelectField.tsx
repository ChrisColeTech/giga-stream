import { ChevronDown } from "lucide-react";
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

/* The family's select (Giga Images' `Select`): one control height, the same border and focus ring as a text field, and
 * a chevron icon in place of the browser's arrow. The chevron is decorative, so it is muted. */
/** The one select of the interface: a 28 px field on the family's border, with its name for assistive technology. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  reason,
  className,
}: SelectFieldProps) {
  return (
    <span className="relative flex min-w-0 w-full">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        title={reason}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-ctl-md w-full min-w-0 cursor-pointer appearance-none rounded-ctl border border-border bg-surface",
          "pr-7 pl-2",
          "font-sans text-xs text-text outline-none transition-[border-color,box-shadow] duration-fade ease-linear",
          "enabled:hover:border-dim focus:border-accent focus:shadow-[0_0_0_2px_var(--color-accent-tint)]",
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
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted"
      />
    </span>
  );
}
