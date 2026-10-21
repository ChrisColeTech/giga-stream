import test from "node:test";
import assert from "node:assert/strict";

import { clampPosition, entryState } from "../src/threshold";

test("past the watchedPercent share the entry flips to watched, at the share itself", () => {
  // The fileserver pins this through PUT /api/watch (favorites-watch.test.ts): 9600 of 10_000 at
  // the 90 default answers `watched`. The rule is `positionMs >= durationMs * percent / 100`, so
  // the share itself counts and a tick below it does not.
  assert.equal(entryState(undefined, 9600, 10_000, 90), "watched");
  assert.equal(entryState(undefined, 9000, 10_000, 90), "watched");
  assert.equal(entryState(undefined, 8999, 10_000, 90), "watching");
});

test("the threshold follows the passed-in percent, not a constant", () => {
  // Mirrors favorites-watch.test.ts: with watchedPercent at 100, 96 percent stays watching and
  // the full duration flips. No call site may decide `watched` from its own constant.
  assert.equal(entryState(undefined, 9600, 10_000, 100), "watching");
  assert.equal(entryState(undefined, 10_000, 10_000, 100), "watched");
});

test("watched is sticky: no write sends the entry back to watching", () => {
  // Mirrors favorites-watch.test.ts: after the flip, a write at position 10 with a duration still
  // answers `watched`.
  assert.equal(entryState("watched", 10, 10_000, 90), "watched");
  assert.equal(entryState("watched", 10_000, undefined, 90), "watched");
});

test("a write without a duration cannot cross any threshold", () => {
  // The opening write and an embed that reports no duration stay `watching` however far they are.
  assert.equal(entryState(undefined, 5_000, undefined, 90), "watching");
  assert.equal(entryState(undefined, 10_000, undefined, 90), "watching");
});

test("a position past a known end is stored as the end", () => {
  // docs/30 section 3.4: the player's last tick can overshoot by a frame.
  assert.equal(clampPosition(10_001, 10_000), 10_000);
  assert.equal(clampPosition(10_000, 10_000), 10_000);
  assert.equal(clampPosition(9_000, 10_000), 9_000);
  assert.equal(clampPosition(9_000, undefined), 9_000);
});
