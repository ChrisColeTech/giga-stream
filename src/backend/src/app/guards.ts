import type { BrowserWindow, Session } from "electron";

import { describeTarget, judgeNavigation } from "./navigation.js";
import { PlayerPolicyAuthority, type FrameIdentity } from "./player-policy.js";
import { playerPolicyLifecycle } from "./player-policy-lifecycle.js";

export type GuardReport = { kind: string; url?: string; permission?: string; origin?: string; blocked: boolean };

/** Permissions the admin page may have; everything else it asks for is refused and reported. */
const ALLOWED_PERMISSIONS = new Set(["fullscreen"]);

/** A navigation the main process can veto: Electron's will-* events pass one merged details object. */
export type VetoableNavigation = { preventDefault: () => void; url: string };

/** A frame navigation adds the frame it happens in and whether it is the main frame's. */
export type FrameNavigation = VetoableNavigation & { isMainFrame: boolean; frame: FrameIdentity | null };

/**
 * The two navigation guards (docs/55 decision 9), pure so a test can drive them with plain objects: `main` keeps
 * a top-level navigation on the window's own origins exactly as before; `frame` lets a frame navigate there or,
 * while a preview's policy is set, to the policy's own origins - and nothing more. A refused navigation reports
 * a direct child of the app frame as a hijack, anything deeper as a plain frame refusal.
 */
export function navigationGuards(
  allowed: ReadonlySet<string>,
  authority: PlayerPolicyAuthority,
  mainFrameId: () => number,
  report: (entry: GuardReport) => void,
): { main: (details: VetoableNavigation) => void; frame: (details: FrameNavigation) => void } {
  const main = (details: VetoableNavigation): void => {
    if (judgeNavigation(allowed, details.url) === "allow") return;
    details.preventDefault();
    report({ kind: "navigate", url: describeTarget(details.url), blocked: true });
  };
  const frame = (details: FrameNavigation): void => {
    if (details.isMainFrame) {
      main(details);
      return;
    }
    const target = details.frame;
    if (
      target !== null &&
      (judgeNavigation(allowed, details.url) === "allow" || authority.judge(target, details.url) === "allow")
    ) {
      return;
    }
    details.preventDefault();
    const direct = target?.parent?.frameTreeNodeId === mainFrameId();
    report({ kind: direct ? "player hijack" : "frame navigate", url: describeTarget(details.url), blocked: true });
  };
  return { main, frame };
}

/**
 * The ways a page can leave or open a window, and permission requests (docs/55 decision 9). The main frame and every
 * frame stay on the origins in `allowed` (the backend's own and, unpackaged, the admin's Vite server); a frame may
 * additionally navigate to the origins of the preview's current embed policy while a preview is open, the
 * fileserver's player-policy port. `will-navigate` and `will-redirect` stay exactly as strict as before, so a
 * top-level navigation never goes to a provider; a new window is always denied; each refusal is reported to the
 * log, not opened anywhere.
 */
export function installGuards(
  window: BrowserWindow,
  session: Session,
  allowed: ReadonlySet<string>,
  report: (entry: GuardReport) => void,
): { authority: PlayerPolicyAuthority; canAcceptPolicy: () => boolean } {
  const mainFrameId = (): number => window.webContents.mainFrame.frameTreeNodeId;
  const authority = new PlayerPolicyAuthority(mainFrameId());
  const lifecycle = playerPolicyLifecycle(authority);
  const guards = navigationGuards(allowed, authority, mainFrameId, report);

  window.webContents.on("will-navigate", guards.main);
  window.webContents.on("will-redirect", guards.main);
  window.webContents.on("will-frame-navigate", guards.frame);
  window.webContents.on("did-start-navigation", (details) => lifecycle.didStartNavigation(details));
  window.webContents.on("frame-created", (_event, details) => {
    if (details.frame !== null) lifecycle.frameCreated(details.frame);
  });
  window.webContents.on("did-navigate", () => lifecycle.didCommitMainFrame(window.webContents.mainFrame));
  window.webContents.on("render-process-gone", () => lifecycle.renderProcessGone());
  window.webContents.setWindowOpenHandler(({ url, disposition }) => {
    report({ kind: "popup", url: `${describeTarget(url)} (${disposition})`, blocked: true });
    return { action: "deny" };
  });
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const permitted = ALLOWED_PERMISSIONS.has(permission);
    report({ kind: "permission", permission, origin: describeTarget(details.requestingUrl ?? ""), blocked: !permitted });
    callback(permitted);
  });
  return { authority, canAcceptPolicy: lifecycle.canAcceptPolicy };
}
