import type { ReactNode } from "react";

/** The scrolling centre stage of a work surface's body: a 16px side padding and a form one column wide, at most 760px,
 *  left-aligned beside the rail. It is a size container, so a row's label goes beside its control or above it by the room
 *  the surface actually has, not by the main window's width. */
export function Workspace({ children }: { children: ReactNode }) {
  return (
    <div className="@container min-h-0 min-w-0 flex-1 overflow-auto px-4 pb-6">
      <div className="max-w-[760px]">{children}</div>
    </div>
  );
}
