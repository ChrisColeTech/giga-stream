import electron = require("electron");

const { contextBridge, ipcRenderer } = electron;

/**
 * The admin page's only channel to the main process. CommonJS (`.cts` -> `preload.cjs`) because the window runs
 * sandboxed, and Electron only loads an ESM preload without the sandbox.
 *
 * Exactly four named capabilities, no generic invoke, and `ipcRenderer` itself is never exposed. In a plain browser
 * `window.adminHost` is undefined, which is how the page knows `Choose` is not available there.
 */
type Overlay = { color?: string; symbolColor?: string; height?: number };
type PlayerPolicy = { origin: string; frameOrigins: string[] };

contextBridge.exposeInMainWorld("adminHost", {
  /** The native folder picker: the chosen path on the backend's machine, or null when cancelled. */
  chooseFolder: (): Promise<string | null> => ipcRenderer.invoke("admin:choose-folder"),
  /** The Windows caption strip's colours, so the buttons follow the theme. Answers false when it cannot. */
  setOverlay: (overlay: Overlay): Promise<boolean> => ipcRenderer.invoke("admin:set-overlay", overlay),
  /** The preview's embed policy (docs/55 decision 9): the provider origins its iframe may load. */
  setPlayerPolicy: (policy: PlayerPolicy): Promise<void> => ipcRenderer.invoke("admin:set-player-policy", policy),
  clearPlayerPolicy: (): Promise<void> => ipcRenderer.invoke("admin:clear-player-policy"),
});
