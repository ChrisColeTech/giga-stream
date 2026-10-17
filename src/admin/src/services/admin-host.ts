/* The admin's only service in this plan (`28` section 9.5, `29` section 13): the Electron preload the backend's own window
 * exposes as `window.adminHost`. In a plain browser it does not exist and every function here says so, so a control can
 * stay in place, disabled, with its reason. The preload exposes exactly these two calls and nothing else. */

export interface OverlayColours {
  readonly color: string;
  readonly symbolColor: string;
  readonly height: number;
}

interface AdminHost {
  /** The native folder dialog: the chosen absolute path, or null when it was cancelled. */
  readonly chooseFolder: () => Promise<string | null>;
  /** Paints the native caption strip: Windows' title bar overlay. */
  readonly setOverlay: (overlay: OverlayColours) => Promise<boolean>;
}

declare global {
  interface Window {
    readonly adminHost?: AdminHost;
  }
}

function host(): AdminHost | undefined {
  return typeof window === "undefined" ? undefined : window.adminHost;
}

/** Whether the page runs in the backend's own window, where the folder dialog and the caption strip exist. */
export function hostAvailable(): boolean {
  return typeof host()?.chooseFolder === "function";
}

/** The chosen folder, or null when none (a cancelled dialog, or no host). A cancelled dialog changes nothing. */
export async function chooseFolder(): Promise<string | null> {
  const found = host();
  return found === undefined ? null : found.chooseFolder();
}

/** Tells the window what the caption strip wears. A browser has no strip: false, and nothing happens. */
export async function setOverlay(overlay: OverlayColours): Promise<boolean> {
  const found = host();
  return found === undefined || typeof found.setOverlay !== "function" ? false : found.setOverlay(overlay);
}
