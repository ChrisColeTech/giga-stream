import type { ReactNode } from "react";

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
}

/* A flat flex column: titlebar, the pages, the events drawer, the statusbar. The shell renders once: pages do not remount
 * the chrome around them. The overlay and the menu are siblings of the frame, not children of it. */
export function AppShell({ titlebar, children, drawer, statusbar, overlay, menu }: AppShellProps) {
  return (
    <>
      <div className="flex h-full flex-col">
        {titlebar}
        {children}
        {drawer}
        {statusbar}
      </div>
      {overlay}
      {menu}
    </>
  );
}
