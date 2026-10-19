// The embed policy's bridge (docs/55 decision 9): the named IPC channels, the lifecycle that revokes a policy
// before a replacement renderer can send, the preload's exposed surface, and the ad rules the window loads.
// Plain objects, no Electron.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { adHostResolverRules } from "../src/app/ad-hosts.js";
import {
  CLEAR_PLAYER_POLICY_CHANNEL,
  installPlayerPolicyIpc,
  SET_PLAYER_POLICY_CHANNEL,
} from "../src/app/player-policy-ipc.js";
import { PlayerPolicyAuthority, type FrameIdentity } from "../src/app/player-policy.js";
import { playerPolicyLifecycle } from "../src/app/player-policy-lifecycle.js";

type IpcEvent = { senderFrame?: { readonly frameTreeNodeId: number } | null };
type Handler = (event: IpcEvent, ...args: unknown[]) => unknown;

function appAndPreview(): { app: FrameIdentity; preview: FrameIdentity; authority: PlayerPolicyAuthority } {
  const app: FrameIdentity = { frameTreeNodeId: 1, parent: null, url: "http://127.0.0.1:8091/admin/" };
  const preview: FrameIdentity = { frameTreeNodeId: 2, parent: app, url: "" };
  const authority = new PlayerPolicyAuthority(app.frameTreeNodeId);
  authority.set({ origin: "https://player.example", frameOrigins: [] });
  assert.equal(authority.judge(preview, "https://player.example/embed"), "allow");
  return { app, preview, authority };
}

test("IPC installs only the two named policy mutations and validates unknown values in main", () => {
  const { app, authority } = appAndPreview();
  const handlers = new Map<string, Handler>();
  let currentFrameId = app.frameTreeNodeId;
  let acceptingPolicy = true;
  installPlayerPolicyIpc(
    { handle: (channel, handler) => handlers.set(channel, handler) },
    () => currentFrameId,
    () => acceptingPolicy,
    authority,
  );
  assert.deepEqual([...handlers.keys()], [SET_PLAYER_POLICY_CHANNEL, CLEAR_PLAYER_POLICY_CHANNEL]);
  assert.equal(SET_PLAYER_POLICY_CHANNEL, "admin:set-player-policy");
  assert.equal(CLEAR_PLAYER_POLICY_CHANNEL, "admin:clear-player-policy");

  const sender = { senderFrame: { frameTreeNodeId: app.frameTreeNodeId } };
  handlers.get(SET_PLAYER_POLICY_CHANNEL)?.(sender, {
    origin: "https://next.example",
    frameOrigins: ["https://media.example"],
  });
  assert.throws(
    () =>
      handlers.get(SET_PLAYER_POLICY_CHANNEL)?.(sender, { origin: "https://next.example", frameOrigins: [], code: "x" }),
    TypeError,
  );
  assert.throws(
    () => handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.({ senderFrame: { frameTreeNodeId: 99 } }),
    /app frame/,
  );
  assert.throws(() => handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.(sender, "unexpected"), TypeError);
  currentFrameId = 2;
  assert.throws(() => handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.(sender), /app frame/);
  currentFrameId = app.frameTreeNodeId;
  acceptingPolicy = false;
  assert.throws(
    () => handlers.get(SET_PLAYER_POLICY_CHANNEL)?.(sender, { origin: "https://next.example", frameOrigins: [] }),
    /changing/,
  );
  acceptingPolicy = true;
  handlers.get(CLEAR_PLAYER_POLICY_CHANNEL)?.(sender);
  assert.equal(authority.active, false);
});

test("main navigation and frame replacement revoke policy before a replacement renderer can send", () => {
  const { authority } = appAndPreview();
  const lifecycle = playerPolicyLifecycle(authority);
  lifecycle.didCommitMainFrame({ frameTreeNodeId: 1, parent: null, url: "http://127.0.0.1:8091/admin/" });
  assert.equal(lifecycle.canAcceptPolicy(), true);
  authority.set({ origin: "https://player.example", frameOrigins: [] });
  lifecycle.didStartNavigation({ isMainFrame: false, isSameDocument: false });
  assert.equal(authority.active, true);
  lifecycle.didStartNavigation({ isMainFrame: true, isSameDocument: true });
  assert.equal(authority.active, true);
  lifecycle.didStartNavigation({ isMainFrame: true, isSameDocument: false });
  assert.equal(authority.active, false, "revoked at navigation start, before commit");
  assert.equal(lifecycle.canAcceptPolicy(), false, "the old document cannot restore policy during replacement");

  authority.set({ origin: "https://player.example", frameOrigins: [] });
  lifecycle.frameCreated({ frameTreeNodeId: 44, parent: null, url: "" });
  assert.equal(authority.active, false, "a replacement main frame starts with no authority");
  assert.equal(lifecycle.canAcceptPolicy(), false);
  lifecycle.didCommitMainFrame({ frameTreeNodeId: 44, parent: null, url: "http://127.0.0.1:8091/admin/" });
  assert.equal(lifecycle.canAcceptPolicy(), true, "only the committed app document may set policy");
  authority.set({ origin: "https://player.example", frameOrigins: [] });
  lifecycle.renderProcessGone();
  assert.equal(authority.active, false);
});

test("the preload exposes the named policy bridge and nothing raw", () => {
  const source = readFileSync("src/app/preload.cts", "utf8");
  assert.match(source, /setPlayerPolicy: \(policy: PlayerPolicy\)/);
  assert.match(source, /clearPlayerPolicy: \(\)/);
  assert.match(source, /"admin:set-player-policy"/);
  assert.match(source, /"admin:clear-player-policy"/);
  assert.doesNotMatch(source, /ipcRenderer:\s*ipcRenderer/, "the raw ipcRenderer object is not exposed");
});

test("the ad rules block ad-named hosts and bypass every other name", () => {
  assert.deepEqual(adHostResolverRules(), "MAP *ads* ~NOTFOUND, MAP ad* ~NOTFOUND, MAP *.ad* ~NOTFOUND");
  const patterns = adHostResolverRules()
    .split(", ")
    .filter((rule) => rule.endsWith("~NOTFOUND"))
    .map((rule) => rule.slice(4, rule.length - " ~NOTFOUND".length));
  const blocked = (host: string): boolean =>
    patterns.some((pattern) => {
      const source = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
      return new RegExp(`^${source}$`).test(host);
    });
  assert.equal(blocked("ads.example"), true);
  assert.equal(blocked("ad.doubleclick.net"), true);
  assert.equal(blocked("tracker.ads.example"), true);
  assert.equal(blocked("adserver.example"), true, "any name whose label starts with ad is refused");
  assert.equal(blocked("loader.example"), false, "a normal host is bypassed");
  assert.equal(blocked("gradient.example"), false);
});
