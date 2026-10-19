/* The admin's only service in this plan (`28` section 9.5, `29` section 13): the Electron preload the backend's own window
 * exposes as `window.adminHost`. In a plain browser it does not exist and every function here says so, so a control can
 * stay in place, disabled, with its reason. The preload exposes exactly these four calls and nothing else. */

export interface OverlayColours {
  readonly color: string;
  readonly symbolColor: string;
  readonly height: number;
}

/** The preview's player policy (`55` decision 9): the exact origins a provider frame may load while a preview is open. */
export interface PlayerPolicy {
  readonly origin: string;
  readonly frameOrigins: readonly string[];
}

interface AdminHost {
  /** The native folder dialog: the chosen absolute path, or null when it was cancelled. */
  readonly chooseFolder: () => Promise<string | null>;
  /** Paints the native caption strip: Windows' title bar overlay. */
  readonly setOverlay: (overlay: OverlayColours) => Promise<boolean>;
  /** The preview's embed policy: the provider origins its frame may load (the preload's `admin:set-player-policy`). */
  readonly setPlayerPolicy: (policy: { origin: string; frameOrigins: string[] }) => Promise<void>;
  /** Ends the policy (the preload's `admin:clear-player-policy`). */
  readonly clearPlayerPolicy: () => Promise<void>;
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

/** Sets the preview's player policy, mirroring the preload's own `setPlayerPolicy`. A refused or throwing IPC call is
 *  dropped: the preview window is the only caller, and its own guard reports load failures. Answers whether a host took
 *  the policy. */
export function setPlayerPolicy(policy: PlayerPolicy): boolean {
  const found = host();
  if (found === undefined || typeof found.setPlayerPolicy !== "function") return false;
  void found
    .setPlayerPolicy({ origin: policy.origin, frameOrigins: [...policy.frameOrigins] })
    .catch((): undefined => undefined);
  return true;
}

/** Ends the player policy, mirroring the preload's own `clearPlayerPolicy`. A browser has no host: nothing happens. */
export function clearPlayerPolicy(): void {
  const found = host();
  if (found === undefined || typeof found.clearPlayerPolicy !== "function") return;
  void found.clearPlayerPolicy().catch((): undefined => undefined);
}
