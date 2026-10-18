import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIBRARY_COPY } from "@/lib/library-copy";
import { DEFAULT_QUERY, type LibraryQuery } from "@/lib/library-query";
import {
  GENRE_SHELVES_MAX,
  groupQuery,
  planShelves,
  shelfGenres,
  shelfQuery,
  type ShelfGroup,
  type ShelfPlanInput,
} from "@/lib/rows-shelves";
import type { CollectionRow } from "@/types/collection";

function collection(id: string, name: string): CollectionRow {
  return { id, name, type: "movie", total: 0, manual: 0, folders: 0, scan: "idle" };
}

const FACETS = ["Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Mystery"];
const BASE: ShelfPlanInput = {
  query: DEFAULT_QUERY,
  genreFacets: FACETS,
  collections: [collection("c-z", "Zebra"), collection("c-a", "Apple")],
  showContinue: true,
};
const ids = (input: ShelfPlanInput): string[] => planShelves(input).map((shelf) => shelf.id);

describe("the shelf list", () => {
  it("is Continue, Favorites, collections by name, the kinds, then the first six genre facets", () => {
    assert.deepEqual(ids(BASE), [
      "continue", "favorites", "collection:c-a", "collection:c-z", "type:movie", "type:tv", "type:local",
      ...FACETS.slice(0, GENRE_SHELVES_MAX).map((genre) => `genre:${genre}`),
    ]);
    assert.equal(planShelves(BASE)[0]?.name, LIBRARY_COPY.continueHeading);
    assert.equal(GENRE_SHELVES_MAX, 6);
  });

  it("drops Continue when the setting is off or the Watched filter rules it out", () => {
    assert.equal(ids({ ...BASE, showContinue: false }).includes("continue"), false);
    for (const watched of ["watched", "unwatched"] as const) {
      assert.equal(ids({ ...BASE, query: { ...DEFAULT_QUERY, watched } }).includes("continue"), false);
    }
    assert.equal(ids({ ...BASE, query: { ...DEFAULT_QUERY, source: "history" } }).includes("continue"), false);
  });

  it("plans Favorites and collections only in the All view", () => {
    const inFavourites = ids({ ...BASE, query: { ...DEFAULT_QUERY, source: "favorites" } });
    assert.equal(inFavourites.some((id) => id === "favorites" || id.startsWith("collection:")), false);
    assert.ok(inFavourites.includes("type:movie"));
    const inCollection = ids({ ...BASE, query: { ...DEFAULT_QUERY, source: "collection:c-a" } });
    assert.equal(inCollection.some((id) => id.startsWith("collection:")), false);
  });

  it("plans only the kind the type strip allows, and no genres for Local", () => {
    const tv = ids({ ...BASE, query: { ...DEFAULT_QUERY, scope: "tv" } });
    assert.deepEqual(tv.filter((id) => id.startsWith("type:")), ["type:tv"]);
    const local = ids({ ...BASE, query: { ...DEFAULT_QUERY, scope: "local" } });
    assert.deepEqual(local.filter((id) => id.startsWith("type:") || id.startsWith("genre:")), ["type:local"]);
  });

  it("takes the genres from the Genre filter when it has values", () => {
    assert.deepEqual(shelfGenres({ ...DEFAULT_QUERY, genres: ["Mystery", "Drama"] }, FACETS), ["Mystery", "Drama"]);
    assert.deepEqual(shelfGenres(DEFAULT_QUERY, ["A", "A", "B"]), ["A", "B"]);
    assert.deepEqual(shelfGenres(DEFAULT_QUERY, []), []);
  });

  it("does not depend on any loaded items: the same inputs give the same plan", () => {
    assert.deepEqual(planShelves(BASE), planShelves({ ...BASE }));
  });
});

describe("per-shelf queries", () => {
  const user: LibraryQuery = { ...DEFAULT_QUERY, search: "star", year: "1999", sort: "az" };
  const query = (group: ShelfGroup, base: LibraryQuery = user): LibraryQuery | null => shelfQuery(base, group);

  it("keeps the user's search, filters and sort and adds the shelf's own narrowing", () => {
    assert.deepEqual(query({ kind: "type", scope: "movie" }), { ...user, scope: "movie" });
    assert.deepEqual(query({ kind: "genre", genre: "Drama" }), { ...user, genres: ["Drama"] });
    assert.deepEqual(query({ kind: "favorites" }), { ...user, source: "favorites" });
    assert.deepEqual(query({ kind: "collection", id: "c-a" }), { ...user, source: "collection:c-a" });
    assert.deepEqual(query({ kind: "continue" }), { ...user, watched: "watching" });
  });

  it("answers null where the shelf and the query cannot both hold", () => {
    assert.equal(query({ kind: "type", scope: "tv" }, { ...user, scope: "movie" }), null);
    assert.equal(query({ kind: "genre", genre: "Drama" }, { ...user, genres: ["Comedy"] }), null);
    assert.equal(query({ kind: "favorites" }, { ...user, source: "history" }), null);
    assert.equal(query({ kind: "continue" }, { ...user, watched: "watched" }), null);
  });

  it("gives every planned shelf its own query", () => {
    const plan = planShelves({ ...BASE, query: user });
    assert.equal(new Set(plan.map((shelf) => JSON.stringify(shelf.query))).size, plan.length);
  });
});

describe("See all", () => {
  it("opens the grid on the shelf's group with the rest clear and the sort kept", () => {
    assert.deepEqual(groupQuery({ kind: "genre", genre: "Drama" }).genres, ["Drama"]);
    assert.equal(groupQuery({ kind: "type", scope: "tv" }).scope, "tv");
    assert.equal(groupQuery({ kind: "favorites" }).source, "favorites");
    assert.equal(groupQuery({ kind: "collection", id: "c-1" }).source, "collection:c-1");
    assert.equal("sort" in groupQuery({ kind: "continue" }), false);
  });
});
