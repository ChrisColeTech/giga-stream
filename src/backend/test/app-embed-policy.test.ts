// The embed policy's navigation guards (src/app; docs/55 decision 9): the pure guard pair the window installs,
// driven with plain objects as the fileserver's guard tests drive its pieces, plus the wiring assertions. No
// Electron is imported here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { navigationGuards, type GuardReport } from "../src/app/guards.js";
import { PlayerPolicyAuthority, type FrameIdentity } from "../src/app/player-policy.js";

const BACKEND = "http://127.0.0.1:8091";
const VITE = "http://127.0.0.1:5172";
const ALLOWED: ReadonlySet<string> = new Set([BACKEND, VITE]);
const PROVIDER = "https://embed.provider.example";
const CDN = "https://cdn.provider.example";

/** One window's guards over one authority, with every refusal the report sink saw. */
function guards() {
  const reports: GuardReport[] = [];
  const app: FrameIdentity = { frameTreeNodeId: 1, parent: null, url: `${BACKEND}/admin/` };
  const authority = new PlayerPolicyAuthority(app.frameTreeNodeId);
  const installed = navigationGuards(
    ALLOWED,
    authority,
    () => app.frameTreeNodeId,
    (entry) => void reports.push(entry),
  );
  /** Drives one navigation and answers whether the guard prevented it, as the will-* events would. */
  const attempt = (
    guard: "frame" | "main",
    details: { url: string; frame?: FrameIdentity | null; isMainFrame?: boolean },
  ): boolean => {
    let prevented = false;
    installed[guard]({
      preventDefault: () => (prevented = true),
      url: details.url,
      isMainFrame: details.isMainFrame ?? false,
      frame: details.frame ?? null,
    });
    return prevented;
  };
  return { app, authority, reports, attempt };
}

function previewFrames(app: FrameIdentity): { preview: FrameIdentity; nested: FrameIdentity } {
  const preview: FrameIdentity = { frameTreeNodeId: 2, parent: app, url: "about:blank" };
  const nested: FrameIdentity = { frameTreeNodeId: 3, parent: preview, url: `${CDN}/video.m3u8` };
  return { preview, nested };
}

test("the frame guard allows the policy's origin and frame origins while the policy is set", () => {
  const { app, authority, attempt } = guards();
  const { preview, nested } = previewFrames(app);
  authority.set({ origin: PROVIDER, frameOrigins: [CDN] });

  assert.equal(attempt("frame", { url: `${PROVIDER}/embed/42`, frame: preview }), false);
  assert.equal(attempt("frame", { url: `${CDN}/video.m3u8`, frame: nested }), false);
  assert.equal(
    attempt("frame", { url: `${VITE}/admin/`, frame: preview }),
    false,
    "the app's own origins stay allowed",
  );
});

test("the frame guard refuses an unmanaged origin and reports the hijack", () => {
  const { app, authority, attempt, reports } = guards();
  const { preview, nested } = previewFrames(app);
  authority.set({ origin: PROVIDER, frameOrigins: [CDN] });

  assert.equal(attempt("frame", { url: "https://unmanaged.example/", frame: preview }), true);
  assert.equal(attempt("frame", { url: "https://unmanaged.example/", frame: nested }), true);
  assert.deepEqual(reports, [
    { kind: "player hijack", url: "https://unmanaged.example", blocked: true },
    { kind: "frame navigate", url: "https://unmanaged.example", blocked: true },
  ]);
});

test("the frame guard refuses every provider origin again once the policy is cleared", () => {
  const { app, authority, attempt } = guards();
  const { preview } = previewFrames(app);
  authority.set({ origin: PROVIDER, frameOrigins: [CDN] });
  assert.equal(attempt("frame", { url: `${PROVIDER}/embed/42`, frame: preview }), false);

  authority.clear();
  assert.equal(attempt("frame", { url: `${PROVIDER}/embed/42`, frame: preview }), true);
  assert.equal(attempt("frame", { url: `${CDN}/video.m3u8`, frame: preview }), true);
  assert.equal(
    attempt("frame", { url: "about:blank", frame: preview }),
    false,
    "frame initialization stays possible so a preview can close",
  );
});

test("a top-level navigation never goes to a provider, even while the policy is set", () => {
  const { authority, attempt, reports } = guards();
  authority.set({ origin: PROVIDER, frameOrigins: [CDN] });

  assert.equal(attempt("main", { url: `${PROVIDER}/embed/42`, isMainFrame: true }), true, "will-navigate refuses it");
  assert.equal(attempt("frame", { url: PROVIDER, isMainFrame: true }), true, "the main frame is never a preview");
  assert.equal(attempt("main", { url: `${VITE}/admin/other`, isMainFrame: true }), false, "own origins still load");
  assert.deepEqual(reports, [
    { kind: "navigate", url: PROVIDER, blocked: true },
    { kind: "navigate", url: PROVIDER, blocked: true },
  ]);
});

test("the window keeps every existing guard and wires the policy beside them", () => {
  const main = readFileSync("src/app/main.ts", "utf8");
  const source = readFileSync("src/app/guards.ts", "utf8");
  assert.match(main, /disableDialogs: true/);
  assert.match(main, /installPlayerPolicyIpc/);
  assert.match(main, /enableAdBlocking\(session\.defaultSession/);
  assert.match(main, /host-resolver-rules/);
  assert.match(source, /on\("will-navigate", guards\.main\)/);
  assert.match(source, /on\("will-redirect", guards\.main\)/, "will-redirect stays exactly as strict as before");
  assert.match(source, /on\("will-frame-navigate", guards\.frame\)/);
  assert.match(source, /"did-start-navigation"/);
  assert.match(source, /"did-navigate"/);
  assert.match(source, /"frame-created"/);
  assert.match(source, /"render-process-gone"/);
  assert.match(source, /setWindowOpenHandler/);
  assert.match(source, /setPermissionRequestHandler/);
});
