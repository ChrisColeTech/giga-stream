import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { CONTINUE_LIMIT } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import { DEFAULT_QUERY } from "@/lib/library-query";
import {
  GENRE_MIN_ITEMS,
  GENRE_SHELVES_MAX,
  buildShelves,
  genreShelves,
  groupQuery,
  type Shelf,
  type ShelfGroup,
} from "@/lib/rows-shelves";
import type { CollectionRow } from "@/types/collection";
import type { LibraryKind } from "@/types/library";

const NO_MARKS = { favourites: {}, memberships: {} };

function item(
  id: string,
  kind: LibraryKind,
  genres: readonly string[],
  extra: Partial<ResolvedItem> = {},
): ResolvedItem {
  return {
    ref: { kind: kind === "local" ? "local" : "title", id },
    kind,
    title: id,
    genres,
    favorite: false,
    collectionIds: [],
    ...extra,
  };
}

function collection(id: string, name: string): CollectionRow {
  return { id, name, type: "movie", total: 0, manual: 0, folders: 0, scan: "idle" };
}

function named(shelves: readonly Shelf[]): string[] {
  return shelves.map((shelf) => shelf.name);
}

function find(shelves: readonly Shelf[], name: string): Shelf {
  const shelf = shelves.find((candidate) => candidate.name === name);
  assert.ok(shelf, `expected a shelf named ${name}`);
  return shelf;
}

describe("buildShelves order", () => {
  it("draws Continue Watching, Favorites, collections, the kinds, then genres, each only with items", () => {
    const items = [
      item("m1", "movie", ["Drama", "Action"], {
        progress: { positionMs: 1, durationMs: 9, state: "watching" },
        favorite: true,
        collectionIds: ["c-b"],
      }),
      item("m2", "movie", ["Drama"], { collectionIds: ["c-a"] }),
      item("m3", "movie", ["Drama", "Action"]),
      item("t1", "tv", ["Drama", "Action"]),
      item("l1", "local", []),
    ];
    const shelves = buildShelves({
      items,
      collections: [collection("c-b", "Zebra"), collection("c-a", "Apple"), collection("c-k", "Kids")],
      marks: NO_MARKS,
    });
    assert.deepEqual(named(shelves), [
      LIBRARY_COPY.continueHeading,
      "Favorites",
      "Apple",
      "Zebra",
      "Movies",
      "TV",
      "Local files",
      "Drama",
    ]);
  });

  it("draws no shelf for an empty collection, a kind with no items, or no progress", () => {
    const shelves = buildShelves({
      items: [item("t1", "tv", [])],
      collections: [collection("c-k", "Kids")],
      marks: NO_MARKS,
    });
    assert.deepEqual(named(shelves), ["TV"]);
  });

  it("returns no shelves for an empty library", () => {
    assert.deepEqual(buildShelves({ items: [], collections: [], marks: NO_MARKS }), []);
  });

  it("gives each shelf its count from the items it holds", () => {
    const shelves = buildShelves({
      items: [item("m1", "movie", []), item("m2", "movie", []), item("t1", "tv", [])],
      collections: [],
      marks: NO_MARKS,
    });
    assert.equal(find(shelves, "Movies").items.length, 2);
    assert.equal(find(shelves, "TV").items.length, 1);
  });
});

describe("Continue Watching", () => {
  it("holds only titles being watched, not watched ones, and at most the continue limit", () => {
    const watching = { positionMs: 1, durationMs: 9, state: "watching" as const };
    const many = Array.from({ length: CONTINUE_LIMIT + 3 }, (_, index) =>
      item(`w${index}`, "movie", [], { progress: watching }),
    );
    const watched = { positionMs: 9, durationMs: 9, state: "watched" as const };
    const items = [...many, item("done", "movie", [], { progress: watched })];
    const shelf = find(buildShelves({ items, collections: [], marks: NO_MARKS }), LIBRARY_COPY.continueHeading);
    assert.equal(shelf.items.length, CONTINUE_LIMIT);
    assert.ok(shelf.items.every((entry) => entry.progress?.state === "watching"));
  });
});

describe("Favorites and collections", () => {
  it("reads a favourite from the store's marks before the item's own flag", () => {
    const items = [item("a", "movie", [], { favorite: true }), item("b", "movie", [], { favorite: false })];
    const marks = { favourites: { "title:a": false, "title:b": true }, memberships: {} };
    const shelves = buildShelves({ items, collections: [], marks });
    const favourites = find(shelves, "Favorites");
    assert.deepEqual(favourites.items.map((entry) => entry.ref.id), ["b"]);
  });

  it("sorts collections by name and counts members from each item's membership", () => {
    const items = [
      item("a", "movie", [], { collectionIds: ["c-1"] }),
      item("b", "movie", [], { collectionIds: ["c-1", "c-2"] }),
    ];
    const shelves = buildShelves({
      items,
      collections: [collection("c-2", "Beta"), collection("c-1", "Alpha")],
      marks: NO_MARKS,
    });
    const collectionShelves = shelves.filter((shelf) => shelf.group.kind === "collection");
    assert.deepEqual(named(collectionShelves), ["Alpha", "Beta"]);
    assert.equal(find(shelves, "Alpha").items.length, 2);
    assert.equal(find(shelves, "Beta").items.length, 1);
  });
});

describe("genre shelves", () => {
  it("needs at least three items for a genre", () => {
    assert.equal(GENRE_MIN_ITEMS, 3);
    const two = [item("a", "movie", ["Western"]), item("b", "movie", ["Western"])];
    assert.deepEqual(genreShelves(two), []);
    const three = [...two, item("c", "movie", ["Western"])];
    assert.deepEqual(named(genreShelves(three)), ["Western"]);
  });

  it("draws at most six genre shelves", () => {
    const genres = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const items = genres.flatMap((genre) =>
      [1, 2, 3].map((n) => item(`${genre}${n}`, "movie", [genre])),
    );
    const shelves = genreShelves(items);
    assert.equal(shelves.length, GENRE_SHELVES_MAX);
    assert.equal(GENRE_SHELVES_MAX, 6);
  });

  it("puts each item on at most one genre shelf", () => {
    const items = [
      item("a", "movie", ["Action", "Drama"]),
      item("b", "movie", ["Action", "Drama"]),
      item("c", "movie", ["Action", "Drama"]),
      item("d", "movie", ["Drama"]),
      item("e", "movie", ["Drama"]),
    ];
    const shelves = genreShelves(items);
    const seen = shelves.flatMap((shelf) => shelf.items.map((entry) => entry.ref.id));
    assert.equal(new Set(seen).size, seen.length);
  });

  it("skips a genre that falls below three once earlier shelves took its items", () => {
    // Action and Drama both count four; the tie goes to Action by name, which takes a, b, c, d. Drama then has only e.
    const items = [
      item("a", "movie", ["Action", "Drama"]),
      item("b", "movie", ["Action", "Drama"]),
      item("c", "movie", ["Action", "Drama"]),
      item("d", "movie", ["Action"]),
      item("e", "movie", ["Drama"]),
    ];
    assert.deepEqual(named(genreShelves(items)), ["Action"]);
  });

  it("orders genre shelves by their final item counts, most first, then by name", () => {
    const items = [
      item("a", "movie", ["Mystery"]),
      item("b", "movie", ["Mystery"]),
      item("c", "movie", ["Mystery"]),
      item("d", "movie", ["Horror"]),
      item("e", "movie", ["Horror"]),
      item("f", "movie", ["Horror"]),
      item("g", "movie", ["Horror"]),
      item("h", "movie", ["Comedy"]),
      item("i", "movie", ["Comedy"]),
      item("j", "movie", ["Comedy"]),
    ];
    assert.deepEqual(named(genreShelves(items)), ["Horror", "Comedy", "Mystery"]);
  });

  it("draws no genre shelf for items that carry no genres", () => {
    const items = [item("l1", "local", []), item("l2", "local", []), item("l3", "local", [])];
    assert.deepEqual(genreShelves(items), []);
  });
});

describe("groupQuery", () => {
  it("sets the Genre filter to the one genre, with the rest clear", () => {
    const patch = groupQuery({ kind: "genre", genre: "Drama" });
    assert.deepEqual(patch.genres, ["Drama"]);
    assert.equal(patch.scope, "all");
    assert.equal(patch.source, "all");
    assert.equal(patch.search, "");
    assert.equal(patch.year, "");
    assert.equal(patch.watched, "all");
  });

  it("sets the type strip for a kind", () => {
    assert.equal(groupQuery({ kind: "type", scope: "tv" }).scope, "tv");
    assert.equal(groupQuery({ kind: "type", scope: "tv" }).source, "all");
  });

  it("opens the Favorites view and a collection's view", () => {
    assert.equal(groupQuery({ kind: "favorites" }).source, "favorites");
    assert.equal(groupQuery({ kind: "collection", id: "c-1" }).source, "collection:c-1");
  });

  it("leaves the sort alone, so the user's order carries into the grid", () => {
    const groups: ShelfGroup[] = [{ kind: "continue" }, { kind: "favorites" }, { kind: "type", scope: "movie" }];
    for (const group of groups) {
      assert.equal("sort" in groupQuery(group), false);
    }
    assert.equal(DEFAULT_QUERY.sort, "newest");
  });
});
