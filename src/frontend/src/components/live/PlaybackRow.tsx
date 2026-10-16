import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PlaybackRowProps {
  /** The mono label, in a fixed column beside the control. */
  readonly label: string;
  /** Why the row cannot be used: the row dims and the reason is its tooltip. Absent when the row works. */
  readonly reason?: string;
  readonly children: ReactNode;
}

/** A playback settings row: a mono label beside its control (`02` section 3.3). No text is printed under the control. */
export function PlaybackRow({ label, reason, children }: PlaybackRowProps) {
  const disabled = reason !== undefined;
  return (
    <div
      title={reason}
      data-disabled={disabled || undefined}
      className="grid min-h-6 grid-cols-[96px_minmax(0,1fr)] items-center gap-2 px-2"
    >
      <span className={cn("truncate font-mono text-[11px] text-muted", disabled && "opacity-45")}>{label}</span>
      <div className="flex min-w-0 items-center">{children}</div>
    </div>
  );
}
