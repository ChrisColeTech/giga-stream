import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SLOW_MS } from "../src/constants/live-media.js";
import { createFaultState } from "../src/live/engine/fault-state.js";
import { samplePlaylist } from "./live-fake-source.js";

function setup() {
  const clock = { now: 1000 };
  return { clock, faults: createFaultState(() => clock.now) };
}
const bodyOf = (outcome: { status: number; body?: string }) => outcome.body ?? "";
const sequenceOf = (text: string) => Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(text)?.[1]);

test("with no fault everything passes through", () => {
  const { faults } = setup();
  const body = samplePlaylist(10);
  assert.deepEqual(faults.playlist("a", "360p/index.m3u8", body), { status: 200, body });
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 0 });
  assert.equal(faults.describe("a"), null);
});

test("stall keeps serving the first playlist it saw, per playlist", () => {
  const { faults } = setup();
  faults.set("a", "stall");
  const first = bodyOf(faults.playlist("a", "360p/index.m3u8", samplePlaylist(10)));
  assert.equal(bodyOf(faults.playlist("a", "360p/index.m3u8", samplePlaylist(14))), first);
  assert.equal(sequenceOf(bodyOf(faults.playlist("a", "720p/index.m3u8", samplePlaylist(14)))), 14);
});

test("segment-404, slow-segments and playlist-500 each hit only their own kind of request", () => {
  const { faults } = setup();
  faults.set("a", "segment-404");
  assert.equal(faults.segment("a").status, 404);
  assert.equal(faults.playlist("a", "k", samplePlaylist(3)).status, 200);
  faults.set("a", "slow-segments");
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: DEFAULT_SLOW_MS });
  faults.set("a", "slow-segments", undefined, 1500);
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 1500 });
  faults.set("a", "playlist-500");
  assert.deepEqual(faults.playlist("a", "k", samplePlaylist(1)), { status: 500 });
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 0 });
});

test("discontinuity jumps the sequence and marks the first segment; restart resets it to zero", () => {
  const { faults } = setup();
  faults.set("a", "discontinuity");
  const jumped = bodyOf(faults.playlist("a", "k", samplePlaylist(10)));
  assert.match(jumped, /#EXT-X-MEDIA-SEQUENCE:1010\n#EXT-X-DISCONTINUITY-SEQUENCE:1\n/);
  assert.match(jumped, /#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:/);
  faults.set("a", "restart");
  const first = bodyOf(faults.playlist("a", "k", samplePlaylist(40)));
  assert.equal(sequenceOf(first), 0);
  assert.equal(sequenceOf(bodyOf(faults.playlist("a", "k", samplePlaylist(42)))), 2);
});

test("end appends EXT-X-ENDLIST exactly once", () => {
  const { faults } = setup();
  faults.set("a", "end");
  const once = bodyOf(faults.playlist("a", "k", samplePlaylist(5)));
  assert.equal(once.match(/#EXT-X-ENDLIST/g)?.length, 1);
  assert.equal(bodyOf(faults.playlist("a", "k", once)).match(/#EXT-X-ENDLIST/g)?.length, 1);
});

test("a fault with a duration clears itself; the newest fault replaces the old; channels are independent", () => {
  const { clock, faults } = setup();
  faults.set("a", "segment-404", 5000);
  clock.now = 5999;
  assert.equal(faults.describe("a")?.expiresInMs, 1);
  clock.now = 6000;
  assert.equal(faults.segment("a").status, 200);
  assert.equal(faults.describe("a"), null);
  faults.set("a", "stall");
  faults.set("a", "playlist-500");
  faults.set("b", "end");
  assert.equal(faults.describe("a")?.fault, "playlist-500");
  faults.clear("a");
  assert.equal(faults.describe("a"), null);
  assert.equal(faults.describe("b")?.fault, "end");
});
