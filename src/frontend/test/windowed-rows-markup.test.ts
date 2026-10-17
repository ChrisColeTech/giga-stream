import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosterGrid } from "@/components/library/PosterGrid";
import { PosterList } from "@/components/library/PosterList";
import { LIST_SPEC } from "@/constants/library-window";
import type { ResolvedItem } from "@/lib/library-marks";
import { rowLayout } from "@/lib/window-rows";
import { GRID_SPEC } from "@/constants/library-window";

const items: ResolvedItem[] = Array.from({ length: 5000 }, (_, at) => ({
  ref: { kind: "title", id: `movie-${at}` }, kind: "movie", title: `Title ${at}`,
  genres: [], favorite: false, collectionIds: [], collectionSources: {},
}));
const scroller = { current: null };
const props = {
  items, selected: null, inHistory: false, collections: [], scroller,
  onSelect: () => undefined, onRemoveWatch: () => undefined,
};
const count = (html: string, needle: string): number => html.split(needle).length - 1;
const gaps = (html: string): number[] =>
  [...html.matchAll(/aria-hidden="true" style="height:(\d+)px"/g)].map((match) => Number(match[1]));

describe("windowed poster grid markup", () => {
  const measured = { width: 1500, viewport: 900 };
  const layout = rowLayout(1500 - 24, GRID_SPEC);
  const html = renderToStaticMarkup(createElement(PosterGrid, { ...props, measured }));

  it("mounts only the rows near the viewport, not the 5,000 titles", () => {
    const cards = count(html, "data-card-id=");
    assert.ok(cards > 0 && cards <= layout.columns * 12, `${cards} cards`);
    assert.ok(html.includes('data-index="0"'));
    assert.ok(!html.includes('data-index="4999"'));
  });

  it("stands the unmounted rows in as one gap, so the height is that of every row", () => {
    const rows = Math.ceil(5000 / layout.columns);
    const mounted = count(html, 'class="grid"');
    const [below] = gaps(html);
    assert.equal(gaps(html).length, 1);
    assert.equal((mounted + (below ?? 0) / layout.pitch) * layout.pitch, rows * layout.pitch);
  });

  it("lays each row on explicit columns at the derived height", () => {
    assert.ok(html.includes(`grid-template-columns:repeat(${layout.columns}, minmax(0, 1fr))`));
    assert.ok(html.includes(`height:${layout.rowHeight}px`));
  });

  it("draws the title skeletons, not an empty grid, with no items", () => {
    const empty = renderToStaticMarkup(createElement(PosterGrid, { ...props, items: [], measured }));
    assert.ok(!empty.includes("data-index"));
    assert.ok(empty.includes("aria-hidden"));
  });

  it("draws nothing before the first measurement, then the container only", () => {
    const bare = renderToStaticMarkup(createElement(PosterGrid, props));
    assert.ok(bare.includes('role="group"'));
    assert.equal(count(bare, "data-card-id="), 0);
  });

  it("draws every card when the list is short, with no gap", () => {
    const few = renderToStaticMarkup(createElement(PosterGrid, { ...props, items: items.slice(0, 7), measured }));
    assert.equal(count(few, "data-card-id="), 7);
    assert.equal(gaps(few).length, 0);
  });
});

describe("windowed poster list markup", () => {
  it("mounts a screenful of 68px rows and a gap for the rest", () => {
    const html = renderToStaticMarkup(createElement(PosterList, { ...props, measured: { width: 1000, viewport: 800 } }));
    const rows = count(html, "data-card-id=");
    assert.ok(rows > 0 && rows <= 25, `${rows} rows`);
    assert.ok(html.includes(`height:${LIST_SPEC.fixedHeight}px`));
    const [below] = gaps(html);
    assert.equal(((below ?? 0) + rows * 72), 5000 * 72);
  });
});
