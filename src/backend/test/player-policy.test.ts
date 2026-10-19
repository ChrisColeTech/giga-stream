// The ported player-policy module's semantics (docs/55 decision 9), exactly as the fileserver's tests assert them:
// plain objects, no Electron.
import test from "node:test";
import assert from "node:assert/strict";

import {
  parsePlayerPolicy,
  PlayerPolicyAuthority,
  judgeUnmanagedFrame,
  type FrameIdentity,
  type PlayerPolicy,
} from "../src/app/player-policy.js";

const POLICY: PlayerPolicy = {
  origin: "https://player.example",
  frameOrigins: ["https://media.example:8443"],
};

function frame(frameTreeNodeId: number, parent: FrameIdentity | null, url = ""): FrameIdentity {
  return { frameTreeNodeId, parent, url };
}

test("player policy accepts only its exact data-only origin shape", () => {
  assert.deepEqual(parsePlayerPolicy(POLICY), POLICY);
  assert.deepEqual(
    parsePlayerPolicy({ origin: "https://player.example", frameOrigins: ["https://media.example"] }),
    { origin: "https://player.example", frameOrigins: ["https://media.example"] },
  );
  const invalid: unknown[] = [
    null,
    { origin: "https://player.example" },
    { origin: "https://player.example/path", frameOrigins: [] },
    { origin: "https://user@player.example", frameOrigins: [] },
    { origin: "file://player.example", frameOrigins: [] },
    { origin: "https://player.example", frameOrigins: "https://media.example" },
    { origin: "https://player.example", frameOrigins: [], script: "alert = () => {}" },
    { sourceOrigin: "https://player.example", frameOrigins: [] },
  ];
  for (const value of invalid) assert.throws(() => parsePlayerPolicy(value), TypeError);
});

test("the direct player and every nested navigation use exact origins", () => {
  const app = frame(1, null, "http://127.0.0.1:8091/admin/");
  const player = frame(2, app);
  const nested = frame(3, player);
  const authority = new PlayerPolicyAuthority(app.frameTreeNodeId);
  authority.set(POLICY);

  assert.equal(authority.judge(player, "about:blank"), "allow", "required frame initialization remains possible");
  assert.equal(authority.judge(player, "https://player.example/embed/42?token=hidden"), "allow");
  assert.equal(authority.judge(player, "https://sub.player.example/embed/42"), "refuse", "no subdomain widening");
  assert.equal(authority.judge(player, "https://player.example.evil.test/embed/42"), "refuse");
  assert.equal(authority.judge(nested, "https://player.example/worker"), "allow", "source origin is allowed nested");
  assert.equal(authority.judge(nested, "https://media.example:8443/video"), "allow");
  assert.equal(authority.judge(nested, "https://media.example/video"), "refuse", "ports remain exact");
  assert.equal(authority.judge(nested, "https://cdn.media.example:8443/video"), "refuse");
});

test("hostless and executable schemes are refused except exact blank initialization", () => {
  const app = frame(10, null);
  const player = frame(11, app);
  const nested = frame(12, player);
  const authority = new PlayerPolicyAuthority(app.frameTreeNodeId);
  authority.set(POLICY);
  assert.equal(authority.judge(player, "https://player.example/embed"), "allow");

  for (const target of ["", "about:blank"]) assert.equal(authority.judge(nested, target), "allow");
  for (const target of ["about:srcdoc", "data:text/html,x", "javascript:alert(1)", "file:///tmp/x", "garbage"]) {
    assert.equal(authority.judge(nested, target), "refuse", target);
  }
});

test("set, clear and source switch revoke stale frame identities", () => {
  const app = frame(20, null);
  const stale = frame(21, app);
  const staleLoaded = frame(21, app, "https://player.example/embed");
  const fresh = frame(22, app);
  const authority = new PlayerPolicyAuthority(app.frameTreeNodeId);
  authority.set(POLICY);
  assert.equal(authority.judge(stale, "https://player.example/embed"), "allow");
  authority.set({ origin: "https://next.example", frameOrigins: [] });
  assert.equal(authority.owns(stale), false);
  assert.equal(authority.judge(staleLoaded, "https://next.example/embed"), "refuse", "a loaded stale frame cannot claim");
  assert.equal(
    authority.judge(frame(24, staleLoaded), "https://player.example/tracker"),
    "refuse",
    "a stale nested frame retains no navigation authority",
  );
  assert.equal(authority.judge(fresh, "https://next.example/embed"), "allow");

  authority.clear();
  assert.equal(authority.owns(fresh), false);
  assert.equal(authority.judge(frame(23, app), "https://next.example/embed"), "refuse");
  assert.equal(authority.judge(frame(23, app), "about:blank"), "allow");
});

test("without product policy, unrelated direct frames keep first-origin containment", () => {
  const app = frame(30, null);
  const direct = frame(31, app);
  const nested = frame(32, direct);
  const origins = new Map<number, string>();
  assert.equal(judgeUnmanagedFrame(direct, "https://static.example/page", app.frameTreeNodeId, origins), "allow");
  assert.equal(judgeUnmanagedFrame(direct, "https://static.example/next", app.frameTreeNodeId, origins), "allow");
  assert.equal(judgeUnmanagedFrame(direct, "https://other.example/", app.frameTreeNodeId, origins), "refuse");
  assert.equal(judgeUnmanagedFrame(direct, "javascript:alert(1)", app.frameTreeNodeId, origins), "refuse");
  assert.equal(judgeUnmanagedFrame(nested, "https://nested.example/", app.frameTreeNodeId, origins), "allow");
  assert.equal(judgeUnmanagedFrame(direct, "about:blank", app.frameTreeNodeId, origins), "allow");
  assert.equal(origins.size, 0, "clean stop releases the unmanaged frame identity");
});
