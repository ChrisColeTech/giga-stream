import { Check } from "lucide-react";
import { Tooltip } from "@giga/ui/form/Tooltip";
import { MIN_VARIANTS, MIN_VARIANTS_REASON, VARIANTS } from "@/constants/channel-copy";
import { toggleVariant } from "@/lib/channel-draft";
import type { Variant } from "@/types/admin-channel";

export interface QualityChecklistProps {
  readonly value: readonly Variant[];
  readonly onChange: (value: readonly Variant[]) => void;
}

/** The supplied live qualities as compact checkbox rows. The final two choices stay visibly locked with a focusable
 *  reason, while any unchecked quality can always be added. */
export function QualityChecklist({ value, onChange }: QualityChecklistProps) {
  return (
    <div className="w-full overflow-hidden rounded-ctl border border-border bg-surface" role="group" aria-label="Qualities">
      {VARIANTS.map((variant) => {
        const checked = value.includes(variant);
        const locked = checked && value.length <= MIN_VARIANTS;
        const row = (
          <label className="flex h-8 w-full items-center gap-2 px-3">
            <input
              type="checkbox"
              checked={checked}
              disabled={locked}
              aria-label={`${variant} quality`}
              className="peer sr-only"
              onChange={() => onChange(toggleVariant(value, variant))}
            />
            <span className="flex size-4 items-center justify-center rounded-xs border border-border bg-panel peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
              {checked && <Check className="size-3" strokeWidth={3} aria-hidden />}
            </span>
            <span className="font-mono text-xs text-text">{variant}</span>
          </label>
        );
        return locked ? (
          <Tooltip
            key={variant}
            text={MIN_VARIANTS_REASON}
            focusable
            label={`${variant}. ${MIN_VARIANTS_REASON}`}
            className="flex w-full border-b border-hair last:border-b-0"
          >
            {row}
          </Tooltip>
        ) : <span key={variant} className="flex w-full border-b border-hair last:border-b-0">{row}</span>;
      })}
    </div>
  );
}
