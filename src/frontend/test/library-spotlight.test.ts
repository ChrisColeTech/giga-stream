import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpotlightRow } from "@/components/library/SpotlightRow";
import { LibraryToolbar } from "@/components/library/LibraryToolbar";
import { FilterField } from "@/components/library/FilterField";
import {
  SPOTLIGHT_CLOSED,
  focusedItem,
  playFromSpotlight,
  spotlightFacts,
  spotlightGroups,
  spotlightReducer,
  type SpotlightAction,
  type SpotlightState,
} from "@/lib/spotlight-state";
import type { ItemRef, LibraryItem } from "@/types/library";

const item = (id: string, kind: LibraryItem["kind"], year?: number): LibraryItem => ({
  ref: { kind: kind === "local" ? "local" : "title", id }, kind, title: `Title ${id}`, genres: [], favorite: false,
  ...(year === undefined ? {} : { year }),
});

const run = (...actions: SpotlightAction[]): SpotlightState => actions.reduce(spotlightReducer, SPOTLIGHT_CLOSED);
const RESULTS = [item("a", "movie", 1999), item("f", "local"), item("b", "tv", 2008), item("c", "movie")];
const searched = (): SpotlightState =>
  run({ type: "open" }, { type: "query", query: "ti" }, { type: "searching" }, { type: "results", items: RESULTS });

describe("the spotlight's state", () => {
  it("opens empty, and a query searches then lists titles only, the first row focused", () => {
    assert.deepEqual(run({ type: "open" }), { ...SPOTLIGHT_CLOSED, open: true });
    const typing = run({ type: "open" }, { type: "query", query: "ti" }, { type: "searching" });
    assert.equal(typing.searching, true);
    const done = searched();
    assert.equal(done.searching, false);
    assert.deepEqual(done.results.map((one) => one.ref.id), ["a", "c", "b"], "no local file; the movies, then the series");
    assert.equal(focusedItem(done)?.ref.id, "a");
  });

  it("clears the results when the query is emptied, and drops results that land after it closed", () => {
    const cleared = spotlightReducer(searched(), { type: "query", query: "  " });
    assert.deepEqual([cleared.results.length, cleared.focused, cleared.searching], [0, -1, false]);
    assert.deepEqual(spotlightReducer(SPOTLIGHT_CLOSED, { type: "results", items: RESULTS }), SPOTLIGHT_CLOSED);
  });

  it("moves the focused row with the arrows, Home and End, inside the list", () => {
    const state = searched();
    assert.equal(spotlightReducer(state, { type: "move", by: 1 }).focused, 1);
    assert.equal(spotlightReducer(state, { type: "move", by: -1 }).focused, 0);
    assert.equal(spotlightReducer(state, { type: "edge", to: "last" }).focused, 2);
    assert.equal(spotlightReducer(state, { type: "move", by: 9 }).focused, 2);
    assert.equal(spotlightReducer(state, { type: "focus", index: 1 }).focused, 1);
  });

  it("keeps the spotlight, its query and results while Title information stands over it", () => {
    const ref: ItemRef = { kind: "title", id: "b" };
    const over = spotlightReducer(spotlightReducer(searched(), { type: "move", by: 1 }), { type: "info", ref });
    assert.deepEqual(over.info, ref);
    const dismissed = spotlightReducer(over, { type: "close" });
    assert.equal(dismissed, over, "an outside press or Escape cannot close it under the window");
    const back = spotlightReducer(over, { type: "info-closed" });
    assert.deepEqual(
      [back.open, back.info, back.query, back.results.length, back.focused],
      [true, null, "ti", 3, 1],
      "closing Title information returns to the spotlight as it was",
    );
    assert.deepEqual(spotlightReducer(back, { type: "close" }), SPOTLIGHT_CLOSED);
  });

  it("leaving Library closes it even under Title information", () => {
    const over = spotlightReducer(searched(), { type: "info", ref: { kind: "title", id: "a" } });
    assert.deepEqual(spotlightReducer(over, { type: "leave" }), SPOTLIGHT_CLOSED);
  });

  it("a Play closes the spotlight and asks the Player for the title", () => {
    const asked: ItemRef[] = [];
    const next = playFromSpotlight(item("b", "tv", 2008), (ref) => asked.push(ref));
    assert.deepEqual(next, SPOTLIGHT_CLOSED);
    assert.deepEqual(asked, [{ kind: "title", id: "b" }]);
  });

  it("states a row's year and kind", () => {
    const words = { movie: "Movie", series: "Series" };
    assert.equal(spotlightFacts(item("a", "movie", 1999), words), "1999 · Movie");
    assert.equal(spotlightFacts(item("b", "tv", 2008), words), "2008 · Series");
    assert.equal(spotlightFacts(item("c", "movie"), words), "Movie");
  });
});

const html = (element: ReturnType<typeof createElement>): string => renderToStaticMarkup(element);
const noop = (): void => undefined;
/** A paragraph or a small note: the text under a control the rules forbid (an svg `<path>` is not one). */
const PARAGRAPH = /<(p|small)[\s>]/;

describe("the markup", () => {
  it("draws Search titles right after Refresh in the Library toolbar, as icons with no text", () => {
    const strip = html(createElement(LibraryToolbar, {
      query: { scope: "all", source: "all", search: "", genres: [], year: "", watched: "all", sort: "newest" },
      view: "grid", trending: false, filters: createElement("div"), loading: false,
      onQuery: noop, onView: noop, onRefresh: noop, onSearch: noop,
    }));
    const refresh = strip.indexOf('aria-label="Refresh Library"');
    const search = strip.indexOf('aria-label="Search titles"');
    assert.ok(refresh > 0 && search > refresh, "Search titles follows Refresh");
    assert.ok(strip.includes('title="Search titles"'));
    assert.ok(!/<button[^>]*aria-label="Search titles"[^>]*>[^<]*\w[^<]*</.test(strip), "no word inside the button");
    assert.ok(!PARAGRAPH.test(strip), "no text under a control");
    assert.ok(strip.includes("Filters · 0</button>"));
    assert.ok(strip.includes('aria-label="Sort: Newest"') && strip.includes("Sort: Newest"));
    assert.ok(strip.includes('aria-label="View: Grid"') && strip.includes("View: Grid"));
  });

  it("draws a result row with Play and Info named for the title, and no text under them", () => {
    const row = html(createElement(SpotlightRow, {
      item: item("a", "movie", 1999), focused: true, onHover: noop, onPlay: noop, onInfo: noop,
    }));
    assert.ok(row.includes('aria-label="Play Title a"'));
    assert.ok(row.includes('aria-label="Info Title a"'));
    assert.ok(row.includes(">1999<"), "the year alone; the group header names the kind");
    assert.ok(row.includes('aria-selected="true"') && row.includes('role="option"'));
    assert.ok(!PARAGRAPH.test(row), "no text under a control");
    const buttons = row.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
    assert.equal(buttons.length, 2);
    for (const button of buttons) assert.ok(!/>[^<\s][^<]*</.test(button), "Play and Info are glyphs alone");
  });

  it("groups the results under Movies and Series in the order the arrows walk", () => {
    const groups = spotlightGroups(searched().results);
    assert.deepEqual(groups.map((group) => [group.kind, group.start, group.items.length]), [["movie", 0, 2], ["tv", 2, 1]]);
    assert.deepEqual(spotlightGroups([item("b", "tv")]).map((group) => group.kind), ["tv"], "no empty header");
  });

  it("holds Title information over the search: results landing meanwhile keep it, and only info-closed frees it", () => {
    const over = spotlightReducer(searched(), { type: "info", ref: { kind: "title", id: "a" } });
    const landed = spotlightReducer(over, { type: "results", items: RESULTS });
    assert.deepEqual(landed.info, { kind: "title", id: "a" });
    assert.equal(spotlightReducer(landed, { type: "close" }), landed, "Escape and outside presses are refused");
    assert.equal(spotlightReducer(spotlightReducer(landed, { type: "info-closed" }), { type: "close" }), SPOTLIGHT_CLOSED);
  });

  it("labels the rail's field Filter, with its clear control", () => {
    const field = html(createElement(FilterField, { value: "", onChange: noop }));
    assert.ok(field.includes('aria-label="Filter"'));
    assert.ok(field.includes('placeholder="Filter by title"'));
    assert.ok(field.includes('aria-label="Clear the filter"'));
    assert.ok(field.includes("data-search"));
    assert.ok(!field.includes(">Search<"));
  });
});
