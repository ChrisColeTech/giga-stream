import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RowsSkeleton } from "@/components/library/rows/RowsSkeleton";
import { ShelfTrack, type ShelfTrackProps } from "@/components/library/rows/ShelfTrack";
import { spacerWidth } from "@/components/library/rows/rows-constants";
import { ROWS_TAIL_SKELETONS } from "@/lib/library-limits";
import type { ResolvedItem } from "@/lib/library-marks";
import { shelfRange, shelfSegments } from "@/lib/shelf-window";

function title(at: number): ResolvedItem {
  return {
    ref: { kind: "title", id: `t${at}` }, kind: "movie", title: `Title ${at}`, genres: [], favorite: false,
    collectionIds: [], collectionSources: {},
  };
}

const ITEMS = Array.from({ length: 200 }, (_, at) => title(at));

function track(props: Partial<ShelfTrackProps>): string {
  const range = shelfRange({ scrollLeft: 1980, clientWidth: 1200 }, false, ITEMS.length);
  return renderToStaticMarkup(createElement("ul", null, createElement(ShelfTrack, {
    items: ITEMS, segments: shelfSegments(range, null, ITEMS.length), continuing: false, tail: 0,
    selected: null, collections: [], onSelect: () => undefined, onRemoveWatch: () => undefined, ...props,
  })));
}

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe("a shelf track", () => {
  it("mounts only the windowed cards of a long shelf, with spacers for the rest", () => {
    const html = track({});
    assert.equal(count(html, "<li data-card"), 13);
    assert.ok(html.includes('data-index="6"') && html.includes('data-index="18"'));
    assert.ok(!html.includes('data-index="5"') && !html.includes('data-index="19"'));
    assert.ok(html.includes(spacerWidth(6, false)), "six cards' spacer before the window");
    assert.ok(html.includes(spacerWidth(181, false)), "the rest after it");
    assert.equal(count(html, "data-sentinel"), 1);
  });

  it("draws card skeletons at the tail while a page loads, with no text", () => {
    const tailed = track({ tail: ROWS_TAIL_SKELETONS, segments: shelfSegments({ start: 190, end: 200 }, null, 200) });
    assert.equal(count(tailed, "data-tail"), ROWS_TAIL_SKELETONS);
    assert.ok(tailed.indexOf("data-tail") > tailed.lastIndexOf("data-card"));
    assert.ok(tailed.indexOf("data-sentinel") > tailed.lastIndexOf("data-tail"));
    const tails = tailed.slice(tailed.indexOf("data-tail") - 4, tailed.indexOf("data-sentinel"));
    assert.ok(tails.includes("aspect-[2/3]"));
    assert.equal(count(track({ tail: 0 }), "data-tail"), 0);
  });

  it("draws Continue skeletons in the 16:9 frame", () => {
    const html = track({ continuing: true, tail: 2, segments: [] });
    assert.equal(count(html, "aspect-video"), 2);
  });
});

describe("the Rows skeleton", () => {
  it("is shimmer shapes with no text and no cards", () => {
    const html = renderToStaticMarkup(createElement(RowsSkeleton));
    assert.ok(html.includes("aspect-[2/3]"));
    assert.ok(!html.includes("data-card"));
    assert.equal(html.replace(/<[^>]*>/g, "").trim(), "");
  });
});
