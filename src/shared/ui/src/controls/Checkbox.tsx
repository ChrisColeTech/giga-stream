import { Check, Minus } from "lucide-react";
import { cn } from "../lib/cn";
import { CHECK_BOX } from "./check-box-class";

export interface CheckboxProps {
  /** `"mixed"` is a box over a partly selected list. */
  readonly checked: boolean | "mixed";
  readonly onChange: (checked: boolean) => void;
  /** Required: a tick has no label of its own (`Select Fixture News`). */
  readonly "aria-label": string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/* The ROW-SELECTION tick, and only that: a list's first column, which arms the selection toolbar's verbs. A boolean on a
 * record is the `Toggle`, never this. A button with `role="checkbox"` brings Space for free. */
export function Checkbox({ checked, onChange, disabled = false, className, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-on={checked === false ? undefined : ""}
      disabled={disabled}
      className={cn(CHECK_BOX, className)}
      onClick={() => onChange(checked !== true)}
      {...rest}
    >
      {checked === true && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {checked === "mixed" && <Minus className="size-3.5" strokeWidth={3} aria-hidden />}
    </button>
  );
}
