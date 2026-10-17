import type { ReactNode } from "react";
import { FIELD_LABEL, FIELD_ROW } from "@giga/ui/form/NumberField";
import { cn } from "@giga/ui/lib/cn";

export interface PlaybackRowProps {
  readonly label: string;
  /** Why the row cannot be used: the row dims and the reason is its tooltip. Absent when the row works. */
  readonly reason?: string;
  readonly children: ReactNode;
}

/** A playback settings row on the family rail grammar (LoRA Studio's compose rail): the rail label in its column, the
 *  control beside it. A readout sits at the row's right edge, as the Player inspector's facts do. No text is printed
 *  under the control. */
export function PlaybackRow({ label, reason, children }: PlaybackRowProps) {
  return (
    <div title={reason} className={cn(FIELD_ROW, "min-h-ctl-sm", reason !== undefined && "opacity-45")}>
      <span className={FIELD_LABEL}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
    </div>
  );
}
