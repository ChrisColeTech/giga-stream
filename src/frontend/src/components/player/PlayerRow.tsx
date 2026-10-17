import type { CSSProperties, ReactNode } from "react";
import { FIELD_LABEL, FIELD_ROW, labelColumn } from "@giga/ui/form/NumberField";
import { cn } from "@giga/ui/lib/cn";

/* Every inspector fact shares one label column, sized to the longest label the inspector renders (Year, Quality, Rating,
   Runtime, Seasons, Duration), so the values line up down the pane (LoRA Studio's rail rows, ui/NumberField.tsx). */
const LABEL_COLUMN = { "--label-col": labelColumn(["Duration", "Quality", "Runtime", "Seasons"]) } as CSSProperties;

export interface PlayerRowProps {
  readonly label: string;
  readonly disabled?: boolean;
  /** The reason the row cannot be used: it rides on the row as its tooltip, and the row dims. */
  readonly reason?: string;
  readonly children?: ReactNode;
}

/** An inspector row on the family rail grammar: the rail label in its fixed column, the control to the right. */
export function PlayerRow({ label, disabled = false, reason, children }: PlayerRowProps) {
  return (
    <div
      title={disabled ? reason : undefined}
      style={LABEL_COLUMN}
      className={cn(FIELD_ROW, "min-h-ctl-sm", disabled && "opacity-45")}
    >
      <span className={FIELD_LABEL}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{children}</div>
    </div>
  );
}
