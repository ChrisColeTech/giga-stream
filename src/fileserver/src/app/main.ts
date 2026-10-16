import path from "node:path";

import { app, BrowserWindow, dialog, screen, session } from "electron";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../build-app.js";
import { config } from "../config.js";
import { enableAdBlocking } from "./ad-blocker.js";
import { adHostResolverRules } from "./ad-hosts.js";
import { installGuards, type GuardReport } from "./guards.js";

/**
 * The desktop shell (the Giga Images pattern): the fileserver runs IN this process, so the window is
 * created only after it is listening, quitting closes both, and there is one shutdown path. Context
 * isolation on, node integration off, sandbox on.
 */

// Ad-named hosts never resolve, from any frame or worker. Must be set before the app is ready.
app.commandLine.appendSwitch("host-resolver-rules", adHostResolverRules());

let server: FastifyInstance | null = null;
let mainWindow: BrowserWindow | null = null;

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

function createWindow(url: string): BrowserWindow {
  const window = new BrowserWindow({
    ...windowSize(),
    show: false,
    backgroundColor: "#111113",
    title: "Giga Stream",
    // The page draws its own 40px bar; Windows keeps its real caption buttons painted over it.
    ...(process.platform === "win32"
      ? { titleBarStyle: "hidden" as const, titleBarOverlay: { color: "#18181b", symbolColor: "#a3a3ac", height: 40 } }
      : {}),
    webPreferences: {
      preload: path.join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      allowRunningInsecureContent: false,
    },
  });
  const report = (entry: GuardReport): void => {
    if (!window.isDestroyed()) window.webContents.send("poc:guard", entry);
  };
  installGuards(window, session.defaultSession, new URL(url).origin, report);
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    mainWindow = null;
  });
  void window.loadURL(url + (process.env.POC_QUERY ?? ""));
  return window;
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => mainWindow?.focus());

  app
    .whenReady()
    .then(async () => {
      server = await buildApp({
        openFolderPicker: async () => {
          if (mainWindow === null || mainWindow.isDestroyed()) return "cancelled" as const;
          const answer = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"], title: "Choose a folder" });
          const chosen = answer.filePaths.at(0);
          return answer.canceled || chosen === undefined ? ("cancelled" as const) : { path: chosen };
        },
      });
      await server.listen({ host: "127.0.0.1", port: config.port });
      const url = `http://127.0.0.1:${config.port}/`;
      const filters = await enableAdBlocking(session.defaultSession, (blocked) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send("poc:guard", { kind: "ad blocked", url: `${blocked.host} (${blocked.type})`, blocked: true });
      });
      server.log.info({ url, filters }, "desktop shell started; ad blocking on");
      mainWindow = createWindow(url);
    })
    .catch((error: unknown) => {
      console.error(`\n[giga-stream] failed to start\n${error instanceof Error ? error.message : String(error)}\n`);
      app.exit(1);
    });

  app.on("window-all-closed", () => app.quit());

  let shuttingDown = false;
  app.on("before-quit", (event) => {
    if (shuttingDown || !server) return;
    shuttingDown = true;
    event.preventDefault();
    const instance = server;
    server = null;
    void instance.close().finally(() => app.quit());
  });
}
