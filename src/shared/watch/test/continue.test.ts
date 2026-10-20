import test from "node:test";
import assert from "node:assert/strict";

import { continueEntries } from "../src/continue";
import type { WatchEntry } from "../src/entry";

const watching = (n: number, updatedAt: number): WatchEntry => ({
  watchId: `w${n}`,
  item: { kind: "local", id: `part-${String(n).padStart(2, "0")}` },
  positionMs: 100,
  durationMs: 90_000,
  state: "watching",
  updatedAt,
});

test("continue answers the watching rows, most recently watched first, at most ten", () => {
  // Mirrors library.test.ts: twelve watching entries and a watched one answer ten rows, the
  // watched item absent, Part 11 first and Part 02 tenth (docs/06 section 4.2).
  const entries: WatchEntry[] = [];
  for (let n = 0; n < 12; n++) entries.push(watching(n, 1_000 + n));
  const done: WatchEntry = {
    ...watching(99, 2_000),
    item: { kind: "local", id: "done" },
    positionMs: 89_500,
    state: "watched",
  };
  const answer = continueEntries([...entries, done], 10);
  assert.equal(answer.length, 10, "at most ten");
  assert.ok(!answer.some((one) => one.item.id === "done"), "the watched item is not watching");
  assert.equal(answer[0]?.item.id, "part-11", "most recently watched first");
  assert.equal(answer[9]?.item.id, "part-02");
});

test("an item whose newest entry is watched does not continue, whatever older episodes do", () => {
  // The newest entry per item is the one that counts (docs/30 section 3.3): finishing one episode
  // takes the item out of Continue even when another of it was left mid-way. Both entries are the
  // SAME item; the watched one is the newer.
  const midWay: WatchEntry = { ...watching(1, 1_000), season: 1, episode: 1 };
  const finished: WatchEntry = {
    ...midWay,
    watchId: "w2",
    updatedAt: 2_000,
    season: 1,
    episode: 2,
    state: "watched",
  };
  assert.deepEqual(continueEntries([midWay, finished], 10), []);
});

test("the cap is the caller's named limit", () => {
  // The fileserver passes its CONTINUE_MAX (10); the limit belongs to the answer's owner.
  const entries = Array.from({ length: 12 }, (_, n) => watching(n, 1_000 + n));
  assert.equal(continueEntries(entries, 10).length, 10);
  assert.equal(continueEntries(entries, 3).length, 3);
  assert.equal(continueEntries(entries, 0).length, 0);
});
