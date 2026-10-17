import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RowsShelf } from "@/components/library/rows/RowsShelf";
import { RowsSkeleton } from "@/components/library/rows/RowsSkeleton";
import { ROWS_READ_ITEMS, ROWS_SHELF_CARDS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import { nextRowsSnapshot, rowsReady, rowsWantsPage, settledItems, shelfCards, type RowsInput } from "@/lib/rows-settle";
import { buildShelves, type Shelf } from "@/lib/rows-shelves";

const GENRES = ["Drama", "Comedy", "Action", "Horror", "Sci-Fi", "Romance", "Crime", "Western"];
const NO_MARKS = { favourites: {}, memberships: {} };

function title(at: number): ResolvedItem {
  return {
    ref: { kind: "title", id: `t${at}` }, kind: at % 3 === 0 ? "tv" : "movie", title: `Title ${at}`,
    genres: [GENRES[at % GENRES.length] ?? "Drama", GENRES[(at * 3) % GENRES.length] ?? "Drama"],
    favorite: at % 7 === 0, collectionIds: [], collectionSources: {},
  };
}
const loaded = (count: number): ResolvedItem[] => Array.from({ length: count }, (_, at) => title(at));
const shelvesOf = (items: readonly ResolvedItem[]): Shelf[] =>
  buildShelves({ items, continuing: [], collections: [], marks: NO_MARKS, showContinue: true });
const ids = (shelves: readonly Shelf[]): string[] =>
  shelves.map((shelf) => `${shelf.id}=${shelf.items.map((item) => item.ref.id).join(",")}`);

const READY: RowsInput = {
  key: "a", loading: false, pageFresh: true, sideReady: true, regionsLoading: false,
  held: ROWS_READ_ITEMS, exhausted: false,
};

describe("shelf builder over a fixed set", () => {
  it("is deterministic: the same set gives the same shelves in the same order", () => {
    const first = ids(shelvesOf(settledItems(loaded(500))));
    assert.deepEqual(ids(shelvesOf(settledItems(loaded(500)))), first);
    assert.ok(first.length > 3);
  });

  it("ignores everything past the bound, so a deeper read cannot regroup", () => {
    assert.equal(settledItems(loaded(1052)).length, ROWS_READ_ITEMS);
    assert.deepEqual(ids(shelvesOf(settledItems(loaded(300)))), ids(shelvesOf(settledItems(loaded(1052)))));
  });
});

describe("rows state", () => {
  const build = (): Shelf[] => shelvesOf(settledItems(loaded(ROWS_READ_ITEMS)));

  it("is the skeleton until the settled set is held, fresh, and the side data answered", () => {
    assert.equal(nextRowsSnapshot(null, { ...READY, held: 40 }, build), null);
    assert.equal(nextRowsSnapshot(null, { ...READY, loading: true }, build), null);
    assert.equal(nextRowsSnapshot(null, { ...READY, pageFresh: false }, build), null);
    assert.equal(nextRowsSnapshot(null, { ...READY, sideReady: false }, build), null);
    assert.equal(nextRowsSnapshot(null, { ...READY, regionsLoading: true }, build), null);
    assert.equal(rowsReady({ ...READY, held: 40, exhausted: true }), true);
  });

  it("builds once, then keeps the very same shelves while the key holds", () => {
    const first = nextRowsSnapshot(null, READY, build);
    assert.ok(first !== null && first.shelves.length > 0);
    let builds = 0;
    const counted = (): Shelf[] => { builds += 1; return build(); };
    const later = nextRowsSnapshot(first, { ...READY, held: 400, sideReady: true }, counted);
    assert.equal(later, first);
    assert.equal(builds, 0);
  });

  it("regroups only on an invalidation, going back through the skeleton", () => {
    const first = nextRowsSnapshot(null, READY, build);
    assert.equal(nextRowsSnapshot(first, { ...READY, loading: true }, build), null);
    assert.equal(nextRowsSnapshot(first, { ...READY, key: "b", pageFresh: false }, build), null);
    const rebuilt = nextRowsSnapshot(null, { ...READY, key: "b" }, build);
    assert.equal(rebuilt?.key, "b");
    assert.notEqual(rebuilt, first);
  });

  it("asks for pages only while short of the bound, once at a time", () => {
    const short = { ...READY, held: 40 };
    assert.equal(rowsWantsPage(short, true, false), true);
    assert.equal(rowsWantsPage(short, true, true), false);
    assert.equal(rowsWantsPage(short, false, false), false);
    assert.equal(rowsWantsPage({ ...short, exhausted: true }, true, false), false);
    assert.equal(rowsWantsPage(READY, true, false), false);
  });
});

describe("rows markup", () => {
  it("caps the cards a shelf mounts", () => {
    assert.equal(shelfCards(loaded(80)).length, ROWS_SHELF_CARDS);
    assert.equal(shelfCards(loaded(4)).length, 4);
    const movies = shelvesOf(loaded(80)).find((shelf) => shelf.id === "type:movie");
    assert.ok(movies !== undefined && movies.items.length > ROWS_SHELF_CARDS);
    const html = renderToStaticMarkup(createElement(RowsShelf, {
      shelf: movies, collections: [], selected: null, onSelect: () => undefined,
      onRemoveWatch: () => undefined, onSeeAll: () => undefined,
    }));
    assert.equal(html.split("<li ").length - 1, ROWS_SHELF_CARDS);
    assert.ok(html.includes(`>${movies.items.length}<`));
  });

  it("draws the skeleton as shimmer shapes with no text", () => {
    const html = renderToStaticMarkup(createElement(RowsSkeleton));
    assert.ok(html.includes("aspect-[2/3]"));
    assert.ok(!html.includes("data-card"));
    assert.equal(html.replace(/<[^>]*>/g, "").trim(), "");
  });
});
