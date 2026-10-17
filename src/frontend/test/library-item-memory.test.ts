import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createItemMemory } from "@/store/library-item-memory";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";

const item = (id: string, title = id): LibraryItem => ({
  ref: { kind: "title", id }, kind: "movie", title, genres: [], favorite: false,
});

describe("incremental item memory", () => {
  it("appends new items and replaces a known one in place", () => {
    const remember = createItemMemory();
    const first = remember([], [item("a"), item("b")]);
    const second = remember(first, [item("c"), item("a", "A again")]);
    assert.deepEqual(second.map((row) => row.ref.id), ["a", "b", "c"]);
    assert.equal(second[0]?.title, "A again");
    assert.deepEqual(first.map((row) => row.title), ["a", "b"], "the earlier array is not mutated");
  });

  it("separates the same id of two kinds", () => {
    const remember = createItemMemory();
    const rows = remember([], [item("1"), { ...item("1"), ref: { kind: "local", id: "1" }, kind: "local" }]);
    assert.equal(rows.length, 2);
  });

  it("rebuilds its index when the array was replaced from outside", () => {
    const remember = createItemMemory();
    remember([], [item("a"), item("b")]);
    const replaced = [item("x")];
    const next = remember(replaced, [item("b"), item("x", "X again")]);
    assert.deepEqual(next.map((row) => row.ref.id), ["x", "b"]);
    assert.equal(next[0]?.title, "X again");
  });

  it("takes 27,000 titles in pages without rebuilding a Map per page", () => {
    const remember = createItemMemory();
    let known: LibraryItem[] = [];
    for (let page = 0; page < 675; page += 1) {
      known = remember(known, Array.from({ length: 40 }, (_, at) => item(`t${page * 40 + at}`)));
    }
    assert.equal(known.length, 27000);
  });

  it("serves the store's rememberLibraryItems", () => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.getState().rememberLibraryItems([item("a")]);
    useAppStore.getState().rememberLibraryItems([item("b"), item("a", "A2")]);
    assert.deepEqual(useAppStore.getState().libraryItems.map((row) => row.title), ["A2", "b"]);
  });
});
