import type { BrowserWindow } from "electron";

/**
 * Minimize hides to the tray (docs/26 section 4.1), like close. The decision is pure so a plain node test can pin
 * it; Electron itself never runs in tests.
 */
export type MinimizeAction = "hide" | "leave";

/** What a `minimize` does: hide the window to the tray while the app runs; during a quit, leave it alone. */
export function decideMinimize(quitting: boolean): MinimizeAction {
  return quitting ? "leave" : "hide";
}

/** The calls that bring the window back, in order: a minimised (or minimised-then-hidden) window is restored first
 *  so it returns at its normal size rather than still minimised, then shown, then focused. */
export function revealSteps(minimized: boolean): readonly ("restore" | "show" | "focus")[] {
  return minimized ? ["restore", "show", "focus"] : ["show", "focus"];
}

/** Hides the window the moment it is minimised, so it leaves the taskbar; the tray (or a second launch) brings it
 *  back through `showWindow`. `minimize` fires after the fact, so this hides right behind it. Works on every
 *  restore, because each hide is a fresh `minimize`. */
export function installMinimizeToTray(window: BrowserWindow, isQuitting: () => boolean): void {
  window.on("minimize", () => {
    if (decideMinimize(isQuitting()) === "hide" && !window.isDestroyed()) window.hide();
  });
}
