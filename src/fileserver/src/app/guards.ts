import { webFrameMain, type BrowserWindow, type Session, type WebFrameMain } from "electron";

import { DialogGuardInstaller } from "./dialog-guard.js";
import { describeTarget, judgeMainFrame } from "./navigation.js";
import { PlayerPolicyAuthority } from "./player-policy.js";

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
): PlayerPolicyAuthority {
  const authority = new PlayerPolicyAuthority(window.webContents.mainFrame.frameTreeNodeId);
  const dialogs = new DialogGuardInstaller(authority, report);
  const mainFrameGuard = (details: { preventDefault: () => void; url: string }): void => {
    if (judgeMainFrame(appOrigin, details.url) === "allow") return;
    details.preventDefault();
    report({ kind: "navigate", url: describeTarget(details.url), blocked: true });
  };

  window.webContents.on("will-navigate", mainFrameGuard);
  const frameGuard = (details: {
    preventDefault: () => void;
    url: string;
    isMainFrame: boolean;
    frame: WebFrameMain | null;
  }): void => {
    const frame = details.frame;
    if (details.isMainFrame) {
      mainFrameGuard(details);
      return;
    }
    if (frame !== null && authority.judge(frame, details.url) === "allow") return;
    details.preventDefault();
    const direct = frame?.parent?.frameTreeNodeId === window.webContents.mainFrame.frameTreeNodeId;
    report({ kind: direct ? "player hijack" : "frame navigate", url: describeTarget(details.url), blocked: true });
  };
  window.webContents.on("will-frame-navigate", frameGuard);
  window.webContents.on("will-redirect", frameGuard);
  window.webContents.on("did-frame-navigate", (_event, _url, _code, _status, isMain, processId, routingId) => {
    if (isMain) return;
    const frame = webFrameMain.fromId(processId, routingId);
    if (frame !== undefined) dialogs.install(frame);
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
  return authority;
}
