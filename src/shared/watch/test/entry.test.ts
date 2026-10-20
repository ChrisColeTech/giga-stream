import test from "node:test";
import assert from "node:assert/strict";

import { entryIdentity, itemIdentity, type WatchEntry } from "../src/entry";

const entry = (over: Partial<WatchEntry>): WatchEntry => ({
  watchId: "w1",
  item: { kind: "title", id: "tt200" },
  positionMs: 0,
  state: "watching",
  updatedAt: 1,
  ...over,
});

test("an episode is its own entry; the series without an episode is another", () => {
  // Mirrors favorites-watch.test.ts: the episode write and the movie write of the same title
  // answer different watch ids, because their identities differ.
  const episode = entry({ season: 2, episode: 7 });
  assert.notEqual(entryIdentity(episode), entryIdentity(entry({})));
  assert.equal(entryIdentity(episode), entryIdentity(entry({ season: 2, episode: 7 })));
});

test("the identity is exact: another season, another episode, another item each differ", () => {
  const base = entry({ season: 2, episode: 7 });
  assert.notEqual(entryIdentity(base), entryIdentity(entry({ season: 2, episode: 8 })));
  assert.notEqual(entryIdentity(base), entryIdentity(entry({ season: 3, episode: 7 })));
  assert.notEqual(entryIdentity(base), entryIdentity(entry({ item: { kind: "title", id: "tt201" }, season: 2, episode: 7 })));
  assert.notEqual(
    entryIdentity(base),
    entryIdentity(entry({ item: { kind: "local", id: "tt200" }, season: 2, episode: 7 })),
  );
});

test("an absent episode is its own identity value, not a wildcard", () => {
  // The store's unique index coalesces an absent season/episode to its own key (migration 001),
  // so the series-without-episode entry never collides with any episode entry of it.
  const series = entry({});
  for (const episode of [1, 2, 3]) {
    assert.notEqual(entryIdentity(series), entryIdentity(entry({ episode })));
  }
});

test("the item identity groups an item's entries across its episodes", () => {
  // The newest-entry-per-item selections count an item once, whatever episode was watched.
  assert.equal(itemIdentity(entry({ season: 1, episode: 1 })), itemIdentity(entry({ season: 2, episode: 7 })));
  assert.equal(itemIdentity(entry({})), itemIdentity(entry({ season: 4, episode: 2 })));
  assert.notEqual(itemIdentity(entry({})), itemIdentity(entry({ item: { kind: "title", id: "tt201" } })));
  assert.notEqual(itemIdentity(entry({})), itemIdentity(entry({ item: { kind: "local", id: "tt200" } })));
});
