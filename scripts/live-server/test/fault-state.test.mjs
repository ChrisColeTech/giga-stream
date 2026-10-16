import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SLOW_MS, FAULTS, createFaultState } from "../fault-state.mjs";
import { samplePlaylist } from "./fake-source.mjs";

function setup() {
  const clock = { now: 1000 };
  const faults = createFaultState({ now: () => clock.now });
  return { clock, faults };
}
const sequenceOf = (text) => Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(text)[1]);

test("with no fault everything passes through", () => {
  const { faults } = setup();
  const body = samplePlaylist(10);
  assert.deepEqual(faults.playlist("a", "360p/index.m3u8", body), { status: 200, body });
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 0 });
  assert.equal(faults.active("a"), null);
  assert.equal(faults.describe("a"), null);
});

test("stall keeps serving the first playlist it saw, per playlist", () => {
  const { faults } = setup();
  faults.set("a", { fault: "stall" });
  const first = faults.playlist("a", "360p/index.m3u8", samplePlaylist(10));
  const later = faults.playlist("a", "360p/index.m3u8", samplePlaylist(14));
  assert.equal(sequenceOf(later.body), 10);
  assert.equal(later.body, first.body);
  assert.equal(sequenceOf(faults.playlist("a", "720p/index.m3u8", samplePlaylist(14)).body), 14);
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 0 });
});

test("segment-404 refuses segments and leaves playlists alone", () => {
  const { faults } = setup();
  faults.set("a", { fault: "segment-404" });
  assert.equal(faults.segment("a").status, 404);
  const body = samplePlaylist(3);
  assert.deepEqual(faults.playlist("a", "k", body), { status: 200, body });
});

test("slow-segments delays segments by the default or the given milliseconds", () => {
  const { faults } = setup();
  faults.set("a", { fault: "slow-segments" });
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: DEFAULT_SLOW_MS });
  faults.set("a", { fault: "slow-segments", delayMs: 1500 });
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 1500 });
});

test("playlist-500 fails media playlists and leaves segments alone", () => {
  const { faults } = setup();
  faults.set("a", { fault: "playlist-500" });
  assert.deepEqual(faults.playlist("a", "k", samplePlaylist(1)), { status: 500, body: null });
  assert.deepEqual(faults.segment("a"), { status: 200, delayMs: 0 });
});

test("discontinuity jumps the sequence, bumps the discontinuity sequence and marks the first segment", () => {
  const { faults } = setup();
  faults.set("a", { fault: "discontinuity" });
  const { body } = faults.playlist("a", "k", samplePlaylist(10));
  assert.equal(sequenceOf(body), 1010);
  assert.match(body, /#EXT-X-MEDIA-SEQUENCE:1010\n#EXT-X-DISCONTINUITY-SEQUENCE:1\n/);
  assert.match(body, /#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:/);
  assert.equal(sequenceOf(faults.playlist("a", "k", samplePlaylist(12)).body), 1012);
});

test("restart resets the media sequence to zero and then counts up like a new encoder", () => {
  const { faults } = setup();
  faults.set("a", { fault: "restart" });
  const first = faults.playlist("a", "k", samplePlaylist(40)).body;
  assert.equal(sequenceOf(first), 0);
  assert.match(first, /#EXT-X-DISCONTINUITY\n/);
  assert.equal(sequenceOf(faults.playlist("a", "k", samplePlaylist(42)).body), 2);
});

test("end appends EXT-X-ENDLIST exactly once", () => {
  const { faults } = setup();
  faults.set("a", { fault: "end" });
  const once = faults.playlist("a", "k", samplePlaylist(5)).body;
  assert.equal(once.match(/#EXT-X-ENDLIST/g).length, 1);
  assert.equal(faults.playlist("a", "k", once).body.match(/#EXT-X-ENDLIST/g).length, 1);
  assert.equal(once.trimEnd().split("\n").at(-1), "#EXT-X-ENDLIST");
});

test("a fault with a duration clears itself when the clock passes it", () => {
  const { clock, faults } = setup();
  faults.set("a", { fault: "segment-404", durationMs: 5000 });
  clock.now = 5999;
  assert.equal(faults.segment("a").status, 404);
  assert.equal(faults.describe("a").expiresInMs, 1);
  clock.now = 6000;
  assert.equal(faults.active("a"), null);
  assert.equal(faults.segment("a").status, 200);
  assert.equal(faults.describe("a"), null);
});

test("only one fault is active at a time: the newest replaces the old", () => {
  const { faults } = setup();
  faults.set("a", { fault: "stall" });
  faults.playlist("a", "k", samplePlaylist(10));
  faults.set("a", { fault: "playlist-500" });
  assert.equal(faults.active("a").fault, "playlist-500");
  assert.equal(faults.playlist("a", "k", samplePlaylist(12)).status, 500);
  faults.set("a", { fault: "segment-404" });
  assert.equal(faults.playlist("a", "k", samplePlaylist(12)).status, 200);
});

test("clear, and the clear fault name, return a channel to normal; channels are independent", () => {
  const { faults } = setup();
  faults.set("a", { fault: "end" });
  faults.set("b", { fault: "playlist-500" });
  faults.clear("a");
  assert.equal(faults.active("a"), null);
  assert.equal(faults.active("b").fault, "playlist-500");
  faults.set("b", { fault: "clear" });
  assert.equal(faults.active("b"), null);
});

test("unknown faults and bad numbers are refused with fault.invalid", () => {
  const { faults } = setup();
  assert.throws(() => faults.set("a", { fault: "explode" }), /fault\.invalid/);
  assert.throws(() => faults.set("a", {}), /fault\.invalid/);
  assert.throws(() => faults.set("a", { fault: "stall", durationMs: -5 }), /fault\.invalid: durationMs/);
  assert.throws(() => faults.set("a", { fault: "slow-segments", delayMs: "soon" }), /fault\.invalid: delayMs/);
  assert.equal(faults.active("a"), null);
});

test("the fault list is exactly the docs/10 set", () => {
  assert.deepEqual(
    [...FAULTS].sort(),
    ["discontinuity", "end", "playlist-500", "restart", "segment-404", "slow-segments", "stall"],
  );
});
