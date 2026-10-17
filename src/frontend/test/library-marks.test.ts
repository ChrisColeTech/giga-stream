import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearHistory, removeWatch, resolveItem, resolveItems, seedMarks, setFavorite, setMembership } from "@/lib/library-marks";
import type { LibraryItem } from "@/types/library";

const ITEMS: readonly LibraryItem[] = [
  { ref: { kind: "title", id: "movie-1" }, kind: "movie", title: "One", genres: [], favorite: false },
  {
    ref: { kind: "title", id: "movie-2" },
    kind: "movie",
    title: "Two",
    genres: [],
    favorite: true,
    progress: { positionMs: 10, durationMs: 100, state: "watching" },
  },
];

const MEMBERSHIP = { "movie-1": ["c-a"] };

describe("seeding and resolving marks", () => {
  it("seeds favorites and memberships from the fixtures", () => {
    const marks = seedMarks(ITEMS, MEMBERSHIP);
    const [one, two] = resolveItems(ITEMS, marks);
    assert.equal(one?.favorite, false);
    assert.equal(two?.favorite, true);
    assert.deepEqual(one?.collectionIds, ["c-a"]);
    assert.deepEqual(two?.collectionIds, []);
  });

  it("keeps the fixture progress until History is cleared or an entry is removed", () => {
    const marks = seedMarks(ITEMS, MEMBERSHIP);
    const two = ITEMS[1];
    assert.ok(two !== undefined);
    assert.notEqual(resolveItem(two, marks).progress, undefined);
    assert.equal(resolveItem(two, removeWatch(marks, "movie-2")).progress, undefined);
    assert.equal(resolveItem(two, clearHistory(marks)).progress, undefined);
  });
});

describe("the marks are immutable updates", () => {
  it("sets a favorite without touching the input", () => {
    const marks = seedMarks(ITEMS, MEMBERSHIP);
    const next = setFavorite(marks, "movie-1", true);
    assert.equal(marks.favorite["movie-1"], false);
    assert.equal(next.favorite["movie-1"], true);
  });

  it("adds and removes a membership without duplicates", () => {
    const marks = seedMarks(ITEMS, MEMBERSHIP);
    const added = setMembership(marks, "movie-1", "c-b", true);
    assert.deepEqual(added.collections["movie-1"], ["c-a", "c-b"]);
    const again = setMembership(added, "movie-1", "c-b", true);
    assert.deepEqual(again.collections["movie-1"], ["c-a", "c-b"]);
    const removed = setMembership(again, "movie-1", "c-a", false);
    assert.deepEqual(removed.collections["movie-1"], ["c-b"]);
  });
});
