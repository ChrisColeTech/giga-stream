import { webFrameMain, type BrowserWindow, type Session, type WebFrameMain } from "electron";

import { DialogGuardInstaller } from "./dialog-guard.js";
import { describeTarget, judgeMainFrame } from "./navigation.js";
import { PlayerPolicyAuthority, judgeUnmanagedFrame } from "./player-policy.js";
import { playerPolicyLifecycle } from "./player-policy-lifecycle.js";

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
): { authority: PlayerPolicyAuthority; canAcceptPolicy: () => boolean } {
  const legacyOrigins = new Map<number, string>();
  const authority = new PlayerPolicyAuthority(window.webContents.mainFrame.frameTreeNodeId, () => legacyOrigins.clear());
  const dialogs = new DialogGuardInstaller(authority, report);
  const lifecycle = playerPolicyLifecycle(authority);
  const mainFrameGuard = (details: { preventDefault: () => void; url: string }): void => {
    if (judgeMainFrame(appOrigin, details.url) === "allow") return;
    details.preventDefault();
    report({ kind: "navigate", url: describeTarget(details.url), blocked: true });
  };

  window.webContents.on("will-navigate", mainFrameGuard);
  window.webContents.on("did-start-navigation", (details) => lifecycle.didStartNavigation(details));
  window.webContents.on("frame-created", (_event, details) => {
    if (details.frame !== null) lifecycle.frameCreated(details.frame);
  });
  window.webContents.on("render-process-gone", lifecycle.renderProcessGone);
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
    if (frame !== null) {
      const verdict = authority.active
        ? authority.judge(frame, details.url)
        : judgeUnmanagedFrame(frame, details.url, window.webContents.mainFrame.frameTreeNodeId, legacyOrigins);
      if (verdict === "allow") {
        if (!authority.active && frame.parent?.frameTreeNodeId !== window.webContents.mainFrame.frameTreeNodeId) {
          report({ kind: "frame navigate", url: describeTarget(details.url), blocked: false });
        }
        return;
      }
    }
    details.preventDefault();
    const direct = frame?.parent?.frameTreeNodeId === window.webContents.mainFrame.frameTreeNodeId;
    report({ kind: direct ? "player hijack" : "frame navigate", url: describeTarget(details.url), blocked: true });
  };
  window.webContents.on("will-frame-navigate", frameGuard);
  window.webContents.on("will-redirect", frameGuard);
  window.webContents.on("did-frame-navigate", (_event, _url, _code, _status, isMain, processId, routingId) => {
    const frame = webFrameMain.fromId(processId, routingId);
    if (frame === undefined) return;
    if (isMain) lifecycle.didCommitMainFrame(frame);
    else dialogs.install(frame);
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
  return { authority, canAcceptPolicy: lifecycle.canAcceptPolicy };
}
