import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tip } from "./Tip";

export interface RowProps {
  readonly label: string;
  /** The explanation, a real tooltip on an info glyph at the label; never hint text under the control. */
  readonly tip?: string;
  /** Why the row's control cannot be used right now: the row dims and the reason rides on its label. */
  readonly reason?: string;
  readonly children: ReactNode;
}

/** THE PAGE GRAMMAR'S ROW: a 12px muted control label in a fixed 252px column with its info glyph, the control
 *  spanning the rest of the cell, 8px between them and 24px tall. The label goes above the control when the room is
 *  under the label column, the gutter and the least control (160px). The form is one column: every row is one
 *  full-width cell. */
export function Row({ label, tip, reason, children }: RowProps) {
  return (
    <div
      data-disabled={reason !== undefined || undefined}
      title={reason}
      className="grid min-h-6 min-w-0 grid-cols-1 items-center gap-x-2 gap-y-0.5 @min-[420px]:grid-cols-[252px_minmax(0,1fr)]"
    >
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1 font-sans text-xs leading-4 font-normal text-muted",
          reason !== undefined && "opacity-45",
        )}
      >
        <span className="min-w-0 break-words">{label}</span>
        {tip !== undefined && <Tip text={tip} />}
      </span>
      <span className={cn("flex min-w-0 flex-wrap items-center gap-2", reason !== undefined && "opacity-45")}>
        {children}
      </span>
    </div>
  );
}
