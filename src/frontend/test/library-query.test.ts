import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NO_HISTORY, resolveItems, type ResolvedItem } from "@/lib/library-marks";
import {
  DEFAULT_QUERY,
  collectionSource,
  continueItems,
  filtersAtDefault,
  matchesSource,
  sortedCollections,
  viewCounts,
  visibleItems,
  type LibraryQuery,
} from "@/lib/library-query";
import type { LibraryItem } from "@/types/library";

const ITEMS: readonly LibraryItem[] = [
  { ref: { kind: "title", id: "m-a" }, kind: "movie", title: "Alpha", year: 2001, genres: ["Drama"], favorite: true },
  {
    ref: { kind: "title", id: "t-b" },
    kind: "tv",
    title: "Bravo",
    year: 2010,
    genres: ["Crime", "Drama"],
    favorite: false,
    progress: { positionMs: 100, durationMs: 1000, state: "watching", season: 1, episode: 2 },
  },
  {
    ref: { kind: "local", id: "l-c" },
    kind: "local",
    title: "Charlie",
    year: 1999,
    genres: [],
    favorite: false,
    progress: { positionMs: 1000, durationMs: 1000, state: "watched" },
  },
];

const ALL: readonly ResolvedItem[] = resolveItems(
  ITEMS,
  { favourites: {}, memberships: {} },
  NO_HISTORY,
  { "m-a": ["c-x"], "t-b": ["c-x", "c-y"] },
);
const query = (change: Partial<LibraryQuery>): LibraryQuery => ({ ...DEFAULT_QUERY, ...change });
const titles = (items: readonly ResolvedItem[]): string[] => items.map((item) => item.title);

describe("the views and the scope", () => {
  it("narrows by the type strip", () => {
    assert.deepEqual(titles(visibleItems(ALL, query({ scope: "tv" }))), ["Bravo"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ scope: "local" }))), ["Charlie"]);
  });

  it("offers History as the items with progress, and Favorites as the favorites", () => {
    const first = ALL[0];
    assert.ok(first !== undefined);
    assert.equal(matchesSource(first, "history"), false);
    assert.deepEqual(titles(visibleItems(ALL, query({ source: "history" }))), ["Charlie", "Bravo"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ source: "favorites" }))), ["Alpha"]);
  });

  it("narrows by a collection", () => {
    const source = collectionSource("c-y");
    assert.deepEqual(titles(visibleItems(ALL, query({ source }))), ["Bravo"]);
  });
});

describe("the filters", () => {
  it("searches the title without regard to case", () => {
    assert.deepEqual(titles(visibleItems(ALL, query({ search: "  brAV " }))), ["Bravo"]);
  });

  it("matches any chosen genre, the year exactly, and the watched state", () => {
    assert.deepEqual(titles(visibleItems(ALL, query({ genres: ["Crime"] }))), ["Bravo"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ year: "1999" }))), ["Charlie"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ watched: "unwatched" }))), ["Alpha"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ watched: "watched" }))), ["Charlie"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ watched: "watching" }))), ["Bravo"]);
  });

  it("reports the Filter group at its default", () => {
    assert.equal(filtersAtDefault(DEFAULT_QUERY), true);
    assert.equal(filtersAtDefault(query({ genres: ["Drama"] })), false);
    assert.equal(filtersAtDefault(query({ search: "only search" })), true);
  });
});

describe("the sorts", () => {
  it("orders A to Z and by year, newest first", () => {
    assert.deepEqual(titles(visibleItems(ALL, query({ sort: "az" }))), ["Alpha", "Bravo", "Charlie"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ sort: "year" }))), ["Bravo", "Alpha", "Charlie"]);
  });

  it("orders Newest as the reverse of the list and Oldest as the list", () => {
    assert.deepEqual(titles(visibleItems(ALL, query({ sort: "newest" }))), ["Charlie", "Bravo", "Alpha"]);
    assert.deepEqual(titles(visibleItems(ALL, query({ sort: "oldest" }))), ["Alpha", "Bravo", "Charlie"]);
  });
});

describe("continue watching, counts and collections", () => {
  it("lists only titles being watched, within the scope", () => {
    assert.deepEqual(titles(continueItems(ALL, "all")), ["Bravo"]);
    assert.deepEqual(titles(continueItems(ALL, "movie")), []);
  });

  it("counts every view and every collection", () => {
    const counts = viewCounts(ALL, [
      { id: "c-x", name: "X", total: 0, manual: 0, folders: 0, scan: "idle" },
      { id: "c-y", name: "Y", total: 0, manual: 0, folders: 0, scan: "idle" },
    ]);
    assert.deepEqual(
      { all: counts.all, history: counts.history, favorites: counts.favorites },
      { all: 3, history: 2, favorites: 1 },
    );
    assert.equal(counts.collections["c-x"], 2);
    assert.equal(counts.collections["c-y"], 1);
  });

  it("sorts collections by name", () => {
    const rows = sortedCollections([
      { id: "2", name: "Zed", total: 0, manual: 0, folders: 0, scan: "idle" },
      { id: "1", name: "Alpha", total: 0, manual: 0, folders: 0, scan: "idle" },
    ]);
    assert.deepEqual(rows.map((row) => row.name), ["Alpha", "Zed"]);
  });
});
