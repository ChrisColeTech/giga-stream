import { Check, Minus } from "lucide-react";
import { cn } from "../lib/cn";

export interface CheckboxProps {
  /** `"mixed"` is a header's tick over a partly selected list. */
  readonly checked: boolean | "mixed";
  readonly onChange: (checked: boolean) => void;
  /** Required: a tick has no label of its own (`Select Fixture News`, `Select all channels`). */
  readonly "aria-label": string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/* The ROW-SELECTION tick, and only that (`docs/28` section 4.3, Appendix A row 23): a list's first column, which arms the
 * toolbar's forward verb. A boolean on a record is the `Toggle`, never this. 20px, the Toggle's and the fields' tokens:
 * the recessed surface and its edge off, the accent edge and fill with the ink-coloured check on. A button with
 * `role="checkbox"` brings Space for free. */
const BOX =
  "grid size-5 flex-none cursor-pointer place-items-center rounded-ctl border border-ctl-edge bg-surface p-0 " +
  "text-accent-ink transition-[background,border-color,box-shadow] duration-fade ease-linear hover:border-dim " +
  "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent-tint)] " +
  "disabled:cursor-not-allowed disabled:opacity-45 " +
  "data-on:border-accent data-on:bg-[linear-gradient(180deg,var(--color-accent-strong),var(--color-accent))] " +
  "data-on:shadow-[var(--shadow-ctl-accent),var(--shadow-stroke-hi)]";

export function Checkbox({ checked, onChange, disabled = false, className, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-on={checked === false ? undefined : ""}
      disabled={disabled}
      className={cn(BOX, className)}
      onClick={() => onChange(checked !== true)}
      {...rest}
    >
      {checked === true && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
      {checked === "mixed" && <Minus className="size-3.5" strokeWidth={3} aria-hidden />}
    </button>
  );
}
