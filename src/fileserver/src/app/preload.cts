import electron = require("electron");

const { contextBridge, ipcRenderer } = electron;

/**
 * The page's only channel to the main process. CommonJS (`.cts` → `preload.cjs`) because the window runs
 * sandboxed, and Electron only loads an ESM preload without the sandbox.
 *
 * One named capability, no generic invoke: the proof of concept's page (docs/14) is told about the
 * popups, navigations, permission requests and blocked requests the main process refused, so it can log
 * them. `ipcRenderer` itself is never exposed.
 */
type GuardReport = { kind: string; url?: string; permission?: string; origin?: string; blocked: boolean };

contextBridge.exposeInMainWorld("pocHost", {
  runtime: "electron",
  onGuard: (callback: (report: GuardReport) => void): void => {
    ipcRenderer.on("poc:guard", (_event, report: GuardReport) => callback(report));
  },
});
