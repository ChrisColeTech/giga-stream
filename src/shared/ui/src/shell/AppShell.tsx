import type { ReactNode } from "react";

/** The smallest size the shell keeps: in a smaller window it holds this size and scrolls inside the window. */
export interface ShellMinSize {
  readonly width: number;
  readonly height: number;
}

export interface AppShellProps {
  /** The titlebar. */
  readonly titlebar: ReactNode;
  /** The pages, one per surface; only the active one shows. */
  readonly children: ReactNode;
  /** The events drawer, when the app has one. */
  readonly drawer?: ReactNode;
  readonly statusbar: ReactNode;
  /** The host of the one open work window or popup. */
  readonly overlay?: ReactNode;
  /** The one context menu, when one is open. */
  readonly menu?: ReactNode;
  /** A floor for the shell's size, for an app that runs in a browser tab as well as in its own window (the admin's
   *  900 x 640). Absent, the shell is exactly the window and never scrolls. */
  readonly minSize?: ShellMinSize;
}

/* A flat flex column: titlebar, the pages, the events drawer, the statusbar. The shell renders once: pages do not remount
 * the chrome around them. The overlay and the menu are siblings of the frame, not children of it. With a `minSize` the
 * frame is wrapped in a scroller: a window smaller than the floor scrolls the whole shell, never a page inside it. */
export function AppShell({ titlebar, children, drawer, statusbar, overlay, menu, minSize }: AppShellProps) {
  const frame = (
    <div className="flex h-full flex-col" style={minSize && { minWidth: minSize.width, minHeight: minSize.height }}>
      {titlebar}
      {children}
      {drawer}
      {statusbar}
    </div>
  );
  return (
    <>
      {minSize === undefined ? frame : <div className="h-full w-full overflow-auto">{frame}</div>}
      {overlay}
      {menu}
    </>
  );
}
