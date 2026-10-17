import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DialogGuardInstaller, DIALOG_GUARD_SCRIPT, type GuardedFrame } from "../src/app/dialog-guard.js";
import {
  CLEAR_PLAYER_POLICY_CHANNEL,
  installPlayerPolicyIpc,
  SET_PLAYER_POLICY_CHANNEL,
} from "../src/app/player-policy-ipc.js";
import { PlayerPolicyAuthority, type FrameIdentity } from "../src/app/player-policy.js";

type IpcEvent = { senderFrame?: { readonly frameTreeNodeId: number } | null };
type Handler = (event: IpcEvent, ...args: unknown[]) => unknown;

function appAndPlayer(): { app: FrameIdentity; player: FrameIdentity; authority: PlayerPolicyAuthority } {
  const app: FrameIdentity = { frameTreeNodeId: 1, parent: null, url: "http://127.0.0.1:5171/" };
  const player: FrameIdentity = { frameTreeNodeId: 2, parent: app, url: "" };
  const authority = new PlayerPolicyAuthority(app.frameTreeNodeId);
  authority.set({ sourceOrigin: "https://player.example", frameOrigins: [] });
  assert.equal(authority.judge(player, "https://player.example/embed"), "allow");
  return { app, player, authority };
}

test("IPC installs only the two named policy mutations and validates unknown in main", () => {
  const { app, authority } = appAndPlayer();
  const handlers = new Map<string, Handler>();
  installPlayerPolicyIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, app.frameTreeNodeId, authority);
  assert.deepEqual([...handlers.keys()], [SET_PLAYER_POLICY_CHANNEL, CLEAR_PLAYER_POLICY_CHANNEL]);

  const sender = { senderFrame: { frameTreeNodeId: app.frameTreeNodeId } };
  handlers.get(SET_PLAYER_POLICY_CHANNEL)?.(sender, {
    sourceOrigin: "https://next.example",
    frameOrigins: ["https://media.example"],
  });
  assert.throws(
    () => handlers.get(SET_PLAYER_POLICY_CHANNEL)?.(sender, { sourceOrigin: "https://next.example", frameOrigins: [], code: "x" }),
    TypeError,
  );
  assert.throws(
    () => handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.({ senderFrame: { frameTreeNodeId: 99 } }),
    /app frame/,
  );
  assert.throws(() => handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.(sender, "unexpected"), TypeError);
  handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.(sender);
});

test("the preload exposes named data methods and no generic IPC or script argument", () => {
  const source = readFileSync("src/app/preload.cts", "utf8");
  assert.match(source, /setPlayerPolicy: \(policy: PlayerPolicy\)/);
  assert.match(source, /clearPlayerPolicy: \(\)/);
  assert.doesNotMatch(source, /genericInvoke|executeJavaScript|script:/);
  assert.doesNotMatch(source, /ipcRenderer:\s*ipcRenderer/, "the raw ipcRenderer object is not exposed");
});

test("static dialog no-ops install on player frames and successful execution alone is marked", async () => {
  const { app, player, authority } = appAndPlayer();
  let executed = "";
  const loaded: GuardedFrame = {
    ...player,
    url: "https://player.example/embed/private/path?token=secret",
    isDestroyed: () => false,
    executeJavaScript: (code) => {
      executed = code;
      return Promise.resolve(true);
    },
  };
  const reports: Array<{ kind: string; url?: string }> = [];
  new DialogGuardInstaller(authority, (report) => reports.push(report)).install(loaded);
  await Promise.resolve();
  assert.equal(executed, DIALOG_GUARD_SCRIPT, "main owns one static script");
  assert.match(executed, /alert/);
  assert.match(executed, /confirm/);
  assert.match(executed, /prompt/);
  assert.equal(authority.isInstalled(player.frameTreeNodeId), true);
  assert.equal(reports.length, 0);

  const nested: GuardedFrame = {
    frameTreeNodeId: 3,
    parent: loaded,
    url: "https://player.example/nested/secret?key=value",
    isDestroyed: () => false,
    executeJavaScript: () => Promise.reject(new Error("gone")),
  };
  new DialogGuardInstaller(authority, (report) => reports.push(report)).install(nested);
  await Promise.resolve();
  assert.equal(authority.isInstalled(nested.frameTreeNodeId), false, "a rejected injection is never marked installed");
  assert.deepEqual(reports, [{ kind: "dialog guard failure", url: "https://player.example" }]);
  assert.equal(authority.owns({ ...player, parent: app }), true);
});

test("Electron wiring injects on committed frame navigation and leaves existing guards in place", () => {
  const source = readFileSync("src/app/guards.ts", "utf8");
  assert.match(source, /"did-frame-navigate"/);
  assert.match(source, /"will-frame-navigate"/);
  assert.match(source, /"will-redirect"/);
  assert.match(source, /setWindowOpenHandler/);
  assert.match(source, /setPermissionRequestHandler/);
});
