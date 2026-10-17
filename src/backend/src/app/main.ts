// MUST stay the first import: it reads the env files before config.ts is parsed.
import "./load-env.js";

import path from "node:path";

import { app, BrowserWindow, dialog, screen, session } from "electron";

import { startOrAttach, type BackendHandle } from "./backend-host.js";
import { installGuards } from "./guards.js";
import { installNativeDialogIpc } from "./native-dialog.js";
import { isTrustedSender } from "./trust.js";
import { installWindowOverlayIpc } from "./window-overlay.js";

/**
 * The backend's desktop window (docs/26 section 4.1, the fileserver's pattern): this process runs the admin backend
 * itself, then opens ONE window on the admin app it serves at `/admin/`. Context isolation on, node integration
 * off, sandbox on. Plain `npm start` stays the headless server; this file runs only under `electron .`.
 */

// Dev-only DevTools endpoint on a fixed loopback port, so automation can drive the window like a browser tab. The
// fileserver's window uses 9222; this one 9223, so both can run. The packaged app never opens one.
if (!app.isPackaged) app.commandLine.appendSwitch("remote-debugging-port", "9223");

/** The admin's Vite dev server (src/admin/vite.config.mts), loaded unpackaged when it answers. */
const DEV_URL = "http://127.0.0.1:5172/admin/";
const DEV_WAIT_MS = 3000;
/** `--wait-vite` (the dev stack starts Vite and this window together): give Vite time to come up before falling back. */
const STACK_WAIT_MS = 30_000;
const WAIT_FOR_VITE = process.argv.includes("--wait-vite");
const ADMIN_PATH = "/admin/";
const PROBE_TIMEOUT_MS = 1500;
const PROBE_RETRY_MS = 250;
const BAR = { color: "#18181b", symbolColor: "#a3a3ac", height: 40 } as const;

let backend: BackendHandle | null = null;
let mainWindow: BrowserWindow | null = null;

/** Whether anything answers at the address: any response counts, only a transport failure is a no. */
async function answers(url: string, waitMs: number): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, PROBE_RETRY_MS));
    }
  }
  return false;
}

/** The page the window loads: the Vite server when unpackaged and it answers (edits reload in place), else the
 *  backend's own `/admin/`, which must exist: a missing build is a message, not a window of JSON. */
async function resolveAppUrl(origin: string): Promise<string> {
  if (!app.isPackaged && (await answers(DEV_URL, WAIT_FOR_VITE ? STACK_WAIT_MS : DEV_WAIT_MS))) return DEV_URL;
  const own = `${origin}${ADMIN_PATH}`;
  const reply = await fetch(own, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }).catch(() => null);
  if (reply?.ok !== true) throw new Error("The admin app is not built. Run: npm run build --prefix src/admin");
  return own;
}

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
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    mainWindow = null;
  });
  void window.loadURL(url);
  return window;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => mainWindow?.focus());

  app
    .whenReady()
    .then(async () => {
      backend = await startOrAttach();
      const url = await resolveAppUrl(backend.origin);
      console.info(`[giga-stream-admin] ${backend.attached ? "attached to" : "started"} ${backend.origin}; window on ${url}`);
      mainWindow = createWindow(url, backend.origin);
    })
    .catch((error: unknown) => {
      console.error(`\n[giga-stream-admin] failed to start\n${error instanceof Error ? error.message : String(error)}\n`);
      app.exit(1);
    });

  app.on("window-all-closed", () => app.quit());

  let shuttingDown = false;
  app.on("before-quit", (event) => {
    if (shuttingDown || backend === null) return;
    shuttingDown = true;
    event.preventDefault();
    const instance = backend;
    backend = null;
    void instance.close().finally(() => app.quit());
  });
}
