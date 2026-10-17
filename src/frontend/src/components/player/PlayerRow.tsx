import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PlayerRowProps {
  readonly label: string;
  readonly disabled?: boolean;
  /** The reason the row cannot be used: it rides on the row as its tooltip, and the row dims. */
  readonly reason?: string;
  readonly children?: ReactNode;
}

/** An inspector row (`21` section 3.4a, Cut's row): a control label (12 px, muted) on a fixed track, its control to the
 *  right. A label is never mono (`21` section 8a). */
export function PlayerRow({ label, disabled = false, reason, children }: PlayerRowProps) {
  return (
    <div
      title={disabled ? reason : undefined}
      className={cn("flex min-h-6 items-center gap-2 px-2.5 py-0.5", disabled && "opacity-45")}
    >
      <span className="w-24 flex-none truncate font-sans text-xs text-muted">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{children}</div>
    </div>
  );
}
