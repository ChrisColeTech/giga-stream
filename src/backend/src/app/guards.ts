import type { BrowserWindow, Session } from "electron";

import { describeTarget, judgeNavigation } from "./navigation.js";

export type GuardReport = { kind: string; url?: string; permission?: string; origin?: string; blocked: boolean };

/** Permissions the admin page may have; everything else it asks for is refused and reported. */
const ALLOWED_PERMISSIONS = new Set(["fullscreen"]);

type Navigation = { preventDefault: () => void; url: string };

/**
 * The ways a page can leave or open a window, and permission requests. The main frame and every frame stay on the
 * origins in `allowed` (the backend's own and, unpackaged, the admin's Vite server); a new window is always denied;
 * each refusal is reported to the log, not opened anywhere.
 */
export function installGuards(
  window: BrowserWindow,
  session: Session,
  allowed: ReadonlySet<string>,
  report: (entry: GuardReport) => void,
): void {
  const guard = (details: Navigation): void => {
    if (judgeNavigation(allowed, details.url) === "allow") return;
    details.preventDefault();
    report({ kind: "navigate", url: describeTarget(details.url), blocked: true });
  };
  window.webContents.on("will-navigate", guard);
  window.webContents.on("will-frame-navigate", guard);
  window.webContents.on("will-redirect", guard);
  window.webContents.setWindowOpenHandler(({ url, disposition }) => {
    report({ kind: "popup", url: `${describeTarget(url)} (${disposition})`, blocked: true });
    return { action: "deny" };
  });
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const permitted = ALLOWED_PERMISSIONS.has(permission);
    report({ kind: "permission", permission, origin: describeTarget(details.requestingUrl ?? ""), blocked: !permitted });
    callback(permitted);
  });
}
