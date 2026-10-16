import type { BrowserWindow, Session } from "electron";

import { describeTarget, judgeMainFrame } from "./navigation.js";

export type GuardReport = { kind: string; url?: string; permission?: string; origin?: string; blocked: boolean };

/** Permissions a provider's player may have; everything else it asks for is refused and reported. */
const ALLOWED_PERMISSIONS = new Set(["fullscreen"]);

/**
 * The four ways a page can try to leave or open a window (Giga Images' main.ts lists them; the bug it
 * fixed was wiring only two), and permission requests. Each refusal is reported to the page.
 */
export function installGuards(
  window: BrowserWindow,
  session: Session,
  appOrigin: string,
  report: (entry: GuardReport) => void,
): void {
  const mainFrameGuard = (details: { preventDefault: () => void; url: string }): void => {
    if (judgeMainFrame(appOrigin, details.url) === "allow") return;
    details.preventDefault();
    report({ kind: "navigate", url: describeTarget(details.url), blocked: true });
  };

  window.webContents.on("will-navigate", mainFrameGuard);
  window.webContents.on("will-redirect", mainFrameGuard);
  /**
   * The player frame (a direct child of the page) keeps the origin it was first loaded on. On 2026-10-16
   * VidSrc's ads navigated that frame away on the first press (stellarconductornexus.com → … →
   * green-planet.live), replacing the player with an ad page, so a cross-origin navigation of it is
   * refused. Frames nested inside the player are the provider's business: allowed, and reported.
   */
  const playerOrigins = new Map<number, string>();
  window.webContents.on("will-frame-navigate", (details) => {
    const frame = details.frame;
    if (details.isMainFrame || !frame) return;
    const isPlayer = frame.parent === window.webContents.mainFrame;
    let target = "";
    try {
      target = new URL(details.url).origin;
    } catch {
      target = "";
    }
    if (!isPlayer) {
      report({ kind: "frame navigate", url: describeTarget(details.url), blocked: false });
      return;
    }
    const first = playerOrigins.get(frame.frameTreeNodeId);
    if (first === undefined) {
      playerOrigins.set(frame.frameTreeNodeId, target);
      return;
    }
    if (target === first) return;
    details.preventDefault();
    report({ kind: "player hijack", url: describeTarget(details.url), blocked: true });
  });
  window.webContents.setWindowOpenHandler(({ url, disposition }) => {
    report({ kind: "popup", url: `${describeTarget(url)} (${disposition})`, blocked: true });
    return { action: "deny" };
  });

  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const allowed = ALLOWED_PERMISSIONS.has(permission);
    report({ kind: "permission", permission, origin: describeTarget(details.requestingUrl ?? ""), blocked: !allowed });
    callback(allowed);
  });
}
