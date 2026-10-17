import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PlaybackRowProps {
  /** The label, a 12 px sans word in a fixed column beside the control. */
  readonly label: string;
  /** Why the row cannot be used: the label dims and the reason is its tooltip. Absent when the row works. */
  readonly reason?: string;
  readonly children: ReactNode;
}

/** A playback settings row: a label beside its control, both one control height tall (`21` section 8a). No text is
 *  printed under the control. */
export function PlaybackRow({ label, reason, children }: PlaybackRowProps) {
  const disabled = reason !== undefined;
  return (
    <div
      title={reason}
      data-disabled={disabled || undefined}
      className="grid min-h-ctl-md grid-cols-[96px_minmax(0,1fr)] items-center gap-2 px-2"
    >
      <span className={cn("truncate font-sans text-xs", disabled ? "text-dim" : "text-muted")}>{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}
