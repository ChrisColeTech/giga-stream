import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NO_HISTORY, itemKey, resolveItem, resolveItems, withCleared, withRemoved } from "@/lib/library-marks";
import type { LibraryItem } from "@/types/library";

const ITEMS: readonly LibraryItem[] = [
  { ref: { kind: "title", id: "1" }, kind: "movie", title: "One", genres: [], favorite: false },
  {
    ref: { kind: "title", id: "2" },
    kind: "movie",
    title: "Two",
    genres: [],
    favorite: true,
    progress: { positionMs: 10, durationMs: 100, state: "watching" },
  },
];

const SEED = { "1": ["c-a"] };
const EMPTY = { favourites: {}, memberships: {} };

describe("keys", () => {
  it("keys an item as kind and id, the store's form", () => {
    assert.equal(itemKey({ kind: "local", id: "local-1" }), "local:local-1");
  });
});

describe("resolving an item over the store and the fixture", () => {
  it("reads the fixture favourite and seed memberships while the store has none", () => {
    const [one, two] = resolveItems(ITEMS, EMPTY, NO_HISTORY, SEED);
    assert.equal(one?.favorite, false);
    assert.equal(two?.favorite, true);
    assert.deepEqual(one?.collectionIds, ["c-a"]);
    assert.deepEqual(two?.collectionIds, []);
  });

  it("prefers the store's marks over the fixture", () => {
    const one = ITEMS[0];
    assert.ok(one !== undefined);
    const key = itemKey(one.ref);
    const marks = { favourites: { [key]: true }, memberships: { [key]: ["c-b"] } };
    const resolved = resolveItem(one, marks, NO_HISTORY, SEED);
    assert.equal(resolved.favorite, true);
    assert.deepEqual(resolved.collectionIds, ["c-b"]);
  });

  it("drops progress when an entry is removed or History is cleared", () => {
    const two = ITEMS[1];
    assert.ok(two !== undefined);
    const key = itemKey(two.ref);
    assert.notEqual(resolveItem(two, EMPTY, NO_HISTORY, SEED).progress, undefined);
    assert.equal(resolveItem(two, EMPTY, withRemoved(NO_HISTORY, key), SEED).progress, undefined);
    assert.equal(resolveItem(two, EMPTY, withCleared(), SEED).progress, undefined);
  });
});
