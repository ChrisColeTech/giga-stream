import test from "node:test";
import assert from "node:assert/strict";

import { newestFirst, newestPerItem } from "../src/order";
import type { WatchEntry } from "../src/entry";

const entry = (watchId: string, updatedAt: number, over: Partial<WatchEntry> = {}): WatchEntry => ({
  watchId,
  item: { kind: "local", id: watchId },
  positionMs: 0,
  state: "watching",
  updatedAt,
  ...over,
});

test("entries answer most recently updated first, whatever order they came in", () => {
  // The store orders history `updated_at DESC, rowid DESC` (library-repository); the pure rule is
  // the same newest first.
  const rows = [entry("a", 100), entry("b", 300), entry("c", 200)];
  assert.deepEqual(newestFirst(rows).map((one) => one.watchId), ["b", "c", "a"]);
});

test("the input list is left alone", () => {
  const rows = [entry("a", 100), entry("b", 300)];
  newestFirst(rows);
  assert.deepEqual(rows.map((one) => one.watchId), ["a", "b"]);
});

test("entries written at the same time keep the order they were given in", () => {
  // The store breaks ties by rowid; a stable sort keeps that order instead of shuffling it.
  const rows = [entry("first", 100), entry("second", 100), entry("third", 100)];
  assert.deepEqual(newestFirst(rows).map((one) => one.watchId), ["first", "second", "third"]);
});

test("an item with several episodes counts once, by its newest entry", () => {
  // library-lists pins this for the watched sets and Continue: one row per item, the entry the
  // item was last touched with (docs/30 section 3.3, one resume point per title).
  const rows = [
    entry("old", 100, { item: { kind: "title", id: "tt1" }, season: 1, episode: 1 }),
    entry("mid", 200, { item: { kind: "title", id: "tt2" } }),
    entry("new", 300, { item: { kind: "title", id: "tt1" }, season: 1, episode: 2 }),
  ];
  const newest = newestPerItem(rows);
  assert.deepEqual(newest.map((one) => one.watchId), ["new", "mid"]);
});
