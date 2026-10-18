import type { ChildSpec } from "./child-types";

/** A window opens no larger than this share of the main window, and the user may make it as large as the main window. */
export const OPEN_SHARE = 0.8;

/** A tool window appears this far in from the main window's top-left corner. */
export const CORNER_OFFSET = { x: 64, y: 96 } as const;

/** The grip of a window with no native frame: its edges and corners are this wide, and a press on one resizes. */
export const GRIP = 5;

/** The border of a window with no native frame. */
export const BORDER = 1;

/** The shared header, the gap under it and the content inset: what the chrome adds around a window's body. */
export const TITLE_HEIGHT = 28;
export const HEADER_GAP = 6;
export const INSET = 8;

/** The titlebar's height: a window never covers it, so the titlebar stays reachable behind any modal. */
export const TITLEBAR_HEIGHT = 40;

/** The main window's statusbar height (`shell/Statusbar.tsx`, `h-6`): a maximized window stops above it, and a window's
 *  own status bar (`ChildStatusbar`) is the same height. */
export const STATUSBAR_HEIGHT = 24;

/** The work surfaces (Settings, Collections): what their content wants. The width is the rail (210), a form at its full
 *  width and the workspace's side padding, with air; the height shows the first groups and scrolls the rest. Never less
 *  than the least, which nothing clips. */
export const WORK_WIDTH = 960;
export const WORK_BODY = 700;
export const WORK_LEAST = { width: 640, body: 360 } as const;

/** A work surface: titled, centred, modal, dismissed by Escape unless a field is being typed in. */
export function workSpec(key: string, title: string, overrides: Partial<ChildSpec> = {}): ChildSpec {
  return {
    key,
    title,
    width: WORK_WIDTH,
    body: WORK_BODY,
    minWidth: WORK_LEAST.width,
    minBody: WORK_LEAST.body,
    modal: true,
    place: "centre",
    escape: "unless-typing",
    ...overrides,
  };
}
