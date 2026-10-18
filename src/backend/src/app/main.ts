// MUST stay the first import: it reads the env files before config.ts is parsed.
import "./load-env.js";

import path from "node:path";

import { app, BrowserWindow, dialog, screen, session } from "electron";

import { resolveAppUrl } from "./app-url.js";
import { startOrAttach, type BackendHandle } from "./backend-host.js";
import { installGuards } from "./guards.js";
import { installMinimizeToTray, revealSteps } from "./minimize-to-tray.js";
import { installNativeDialogIpc } from "./native-dialog.js";
import { createTray, type TrayHandle } from "./tray.js";
import { isTrustedSender } from "./trust.js";
import { installWindowOverlayIpc } from "./window-overlay.js";

/**
 * The backend's desktop window (docs/26 section 4.1, the fileserver's pattern): this process runs the admin backend
 * itself, then opens ONE window on the admin app it serves at `/admin/`. Context isolation on, node integration
 * off, sandbox on. The app closes to the system tray: the close and minimize buttons hide the window and only Quit (the tray's,
 * or any other quit) stops the backend. Plain `npm start` stays the headless server; this file runs only under
 * `electron .`.
 */

// Dev-only DevTools endpoint on a fixed loopback port, so automation can drive the window like a browser tab. The
// fileserver's window uses 9222; this one 9223, so both can run. The packaged app never opens one.
if (!app.isPackaged) app.commandLine.appendSwitch("remote-debugging-port", "9223");

const BAR = { color: "#18181b", symbolColor: "#a3a3ac", height: 40 } as const;

let backend: BackendHandle | null = null;
let mainWindow: BrowserWindow | null = null;
/** What the window loads, kept from startup so a destroyed window can be recreated. */
let target: { url: string; origin: string } | null = null;
// Module-level: a Tray that is garbage collected disappears from the notification area.
let tray: TrayHandle | null = null;
/** Set once any quit begins (the tray's, `app.quit()`, a system shutdown): from then on a close really closes. */
let quitting = false;

/** The preferred window clamped to the work area: every number here is a DIP (docs/02 section 1). */
function windowSize(): { width: number; height: number; minWidth: number; minHeight: number } {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  return {
    width: Math.min(1600, width),
    height: Math.min(1000, height),
    minWidth: Math.min(900, width),
    minHeight: Math.min(640, height),
  };
}

/** Shows the same window object again (the page stays loaded): restored when minimised, then focused. A window the
 *  page itself destroyed (`window.close()` from the renderer) is recreated, so the tray always has a way back. */
function showWindow(): void {
  let window = mainWindow;
  if (window === null || window.isDestroyed()) {
    if (target === null || quitting) return;
    window = createWindow(target.url, target.origin); // shown and focused when ready
    mainWindow = window;
    return;
  }
  for (const step of revealSteps(window.isMinimized())) window[step]();
}

function createWindow(url: string, origin: string): BrowserWindow {
  const window = new BrowserWindow({
    ...windowSize(),
    show: false,
    backgroundColor: "#111113",
    title: "Giga Stream Admin",
    // The page draws its own 40px bar; Windows keeps its real caption buttons painted over it.
    ...(process.platform === "win32" ? { titleBarStyle: "hidden" as const, titleBarOverlay: { ...BAR } } : {}),
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
      disableDialogs: true,
    },
  });
  const allowed: ReadonlySet<string> = new Set([origin, new URL(url).origin]);
  const trusted = (event: Parameters<typeof isTrustedSender>[0]): boolean =>
    isTrustedSender(event, () => window.webContents.mainFrame.frameTreeNodeId, allowed);
  installGuards(window, session.defaultSession, allowed, (entry) => console.warn("[guard]", JSON.stringify(entry)));
  installNativeDialogIpc(window.webContents.ipc, trusted, () => window, (_target, options) =>
    dialog.showOpenDialog(window, options),
  );
  installWindowOverlayIpc(window.webContents.ipc, trusted, () => window);
  window.once("ready-to-show", () => {
    window.show();
    window.focus();
  });
  // A crashed or killed renderer is not a dead window: load the page again.
  window.webContents.on("render-process-gone", (_event, details) => {
    if (quitting || details.reason === "clean-exit" || window.isDestroyed()) return;
    console.warn("[giga-stream-admin] the page's process ended:", details.reason);
    window.webContents.reload();
  });
  // Close (the button, Alt+F4) hides while the app runs; a quit lets it through. A logoff or shutdown is a quit too.
  window.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    window.hide();
  });
  // Minimize hides to the tray as well; the tray icon or a second launch restores it.
  installMinimizeToTray(window, () => quitting);
  window.on("session-end", () => {
    quitting = true;
  });
  // Only forgets the window (never quits: `window-all-closed` does nothing); a newer one is left alone.
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window.loadURL(url);
  return window;
}

// Before anything is created: a second launch shows the running window and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);

  app
    .whenReady()
    .then(async () => {
      backend = await startOrAttach();
      const url = await resolveAppUrl(backend.origin);
      console.info(`[giga-stream-admin] ${backend.attached ? "attached to" : "started"} ${backend.origin}; window on ${url}`);
      target = { url, origin: backend.origin };
      mainWindow = createWindow(url, backend.origin);
      tray = createTray({ showWindow, quit: () => app.quit(), address: backend.origin });
    })
    .catch((error: unknown) => {
      console.error(`\n[giga-stream-admin] failed to start\n${error instanceof Error ? error.message : String(error)}\n`);
      app.exit(1);
    });

  // Closing the last window (hidden to the tray) never quits; only an explicit quit does.
  app.on("window-all-closed", () => undefined);

  let shuttingDown = false;
  app.on("before-quit", (event) => {
    quitting = true;
    tray?.destroy();
    tray = null;
    if (shuttingDown || backend === null) return;
    shuttingDown = true;
    event.preventDefault();
    const instance = backend;
    backend = null;
    void instance
      .close()
      .catch((error: unknown) => console.error("[giga-stream-admin] the backend did not close cleanly", error))
      .finally(() => app.quit());
  });
}
