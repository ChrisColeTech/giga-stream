import { Check, Minus } from "lucide-react";
import { cn } from "../lib/cn";
import { CHECK_BOX } from "./check-box-class";

export const ALL_WORD = "All";
export const SELECT_ALL_TIP = "Select every listed row";
export const CLEAR_ALL_TIP = "Clear the selection";

export interface AllCheckboxProps {
  /** All, none (`false`) or some (`"mixed"`) of the listed rows are ticked. */
  readonly checked: boolean | "mixed";
  /** Called with `true` from none or some (select all), `false` from all (clear). */
  readonly onChange: (checked: boolean) => void;
  /** Its accessible name names the list (`Select all channels`); the word shown is `All`. */
  readonly "aria-label": string;
  readonly disabled?: boolean;
}

/* THE THREE-STATE `All` of a selection toolbar (`01` section 9; LoRA Trainer `components/ui/Toggle.tsx` 37-70). It replaces
 * a header tick and a `Clear selection` button: a button cannot show whether anything is selected. From "some" a press
 * reads as "select all", never as clearing the few picked. The row tick's box with the word beside it, one button. */
export function AllCheckbox({ checked, onChange, disabled = false, ...rest }: AllCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      title={checked === true ? CLEAR_ALL_TIP : SELECT_ALL_TIP}
      className={cn(
        "inline-flex h-ctl-sm flex-none cursor-pointer items-center gap-2 rounded-ctl border-0 bg-transparent px-1.5",
        "text-xs font-[550] text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-45",
      )}
      onClick={() => onChange(checked !== true)}
      {...rest}
    >
      <span aria-hidden data-on={checked === false ? undefined : ""} className={cn(CHECK_BOX, "pointer-events-none")}>
        {checked === true && <Check className="size-3.5" strokeWidth={3} />}
        {checked === "mixed" && <Minus className="size-3.5" strokeWidth={3} />}
      </span>
      {ALL_WORD}
    </button>
  );
}
