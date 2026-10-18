import type { ReactNode } from "react";
import { HEADER_GAP, INSET } from "../lib/child-metrics";

export interface ChildStatus {
  readonly left?: ReactNode;
  readonly right?: ReactNode;
}

/** A child window's status bar (`36` section 8.3): the LAST row inside the frame, the main window's statusbar metrics
 *  (`shell/Statusbar.tsx`: `h-6`, hairline above, `font-sans text-xs text-muted`, `gap-2.5`): items left, a spacer, items
 *  right. State only (words, counts), never a control, a notice or a progress bar. It spans the frame edge to edge, so
 *  it undoes the frame's inset on the sides and the foot. */
export function ChildStatusbar({ left, right }: ChildStatus) {
  return (
    <div
      data-child-status
      className="flex h-6 flex-none items-center gap-2.5 border-t border-hair bg-panel px-2.5 font-sans text-xs text-muted"
      style={{ margin: `${HEADER_GAP}px -${INSET}px -${INSET}px` }}
    >
      {left}
      <span className="flex-1" />
      {right}
    </div>
  );
}
