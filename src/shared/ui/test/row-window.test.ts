import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultRangeExtractor, Virtualizer } from "@tanstack/react-virtual";
import { useRowWindow } from "../src/hooks/useRowWindow";
import {
  LIST_LAYOUT, listStep, mountedRange, restoredTop, rowsInView, sameRange, withPinned,
} from "../src/lib/row-window";
import { HEADER_HEIGHT, OVERSCAN_ROWS, ROW_HEIGHT, WINDOW_MIN_ROWS } from "../src/lib/window-constants";

/* The record table's row window (`docs/45` sections 2.1 and 5), ported from the old `list-window` tests: the mounted count
 * is flat however long the list, a hidden (zero-size) surface changes nothing, the focused row stays mounted, keys move
 * by index. The virtualizer is driven without a DOM: no scroll element, so its `initialRect` and `initialOffset` stand in
 * for the measured viewport and offset. */
const VIEW = 10 * ROW_HEIGHT;

function mountedAt(top: number, count: number, height: number = VIEW, pinned: number | null = null): number[] {
  const virtual = new Virtualizer<Element, Element>({
    count,
    getScrollElement: () => null,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollMargin: HEADER_HEIGHT,
    initialRect: { width: 0, height: height > 0 ? height + HEADER_HEIGHT : 0 },
    initialOffset: top,
    rangeExtractor: (range) => withPinned(defaultRangeExtractor(range), pinned, count),
    observeElementRect: () => undefined,
    observeElementOffset: () => undefined,
    scrollToFn: () => undefined,
  });
  return virtual.getVirtualItems().map((item) => item.index);
}

describe("the row window's geometry (docs/45 2.1)", () => {
  it("is one column of 36px rows, two rows of overscan, windowed above 100 rows", () => {
    assert.deepEqual(LIST_LAYOUT, { columns: 1, rowHeight: 36, pitch: 36 });
    assert.equal(OVERSCAN_ROWS, 2);
    assert.equal(WINDOW_MIN_ROWS, 100);
  });
});

describe("the mounted rows", () => {
  it("are a flat number for 101, 5,000 and 27,000 rows, in the middle and at the top", () => {
    const middle = [101, 5000, 27000].map((count) => mountedAt(40 * ROW_HEIGHT, count).length);
    const top = [101, 5000, 27000].map((count) => mountedAt(0, count).length);
    assert.equal(new Set(middle).size, 1);
    assert.equal(new Set(top).size, 1);
    assert.ok((middle[0] ?? 99) <= 16 && (middle[0] ?? 0) >= 10, `${middle[0]} rows in the middle`);
    assert.ok((top[0] ?? 99) < (middle[0] ?? 0), "fewer overscan rows above the first");
  });

  it("reach the last of 27,000 rows and never leave the window empty", () => {
    const end = mountedAt(27000 * ROW_HEIGHT, 27000);
    assert.equal(end.at(-1), 26999);
    assert.equal(mountedAt(1e12, 27000).at(-1), 26999, "an offset carried over from a taller list still shows the end");
  });

  it("are none while the surface has no size (hidden), and the pager range is empty", () => {
    assert.deepEqual(mountedAt(900, 5000, 0), []);
    assert.deepEqual(mountedRange(null, 5000, OVERSCAN_ROWS), { first: 0, last: -1 });
  });

  it("are widened by the overscan, clamped to the list", () => {
    assert.deepEqual(mountedRange({ startIndex: 0, endIndex: 9 }, 5000, 2), { first: 0, last: 11 });
    assert.deepEqual(mountedRange({ startIndex: 4990, endIndex: 4999 }, 5000, 2), { first: 4988, last: 4999 });
    assert.deepEqual(mountedRange({ startIndex: 0, endIndex: 0 }, 0, 2), { first: 0, last: -1 });
  });
});

describe("the focused row stays mounted", () => {
  it("is added to the window wherever it is, in order, once", () => {
    assert.deepEqual(withPinned([10, 11, 12], 2, 5000), [2, 10, 11, 12]);
    assert.deepEqual(withPinned([10, 11, 12], 4000, 5000), [10, 11, 12, 4000]);
    assert.deepEqual(withPinned([10, 11, 12], 11, 5000), [10, 11, 12]);
    assert.deepEqual(withPinned([10, 11, 12], null, 5000), [10, 11, 12]);
    assert.deepEqual(withPinned([10, 11, 12], 5000, 5000), [10, 11, 12], "a row past the end is not a row");
  });

  it("is mounted by the virtualizer far from the viewport", () => {
    const rows = mountedAt(2000 * ROW_HEIGHT, 5000, VIEW, 3);
    assert.equal(rows[0], 3);
    assert.ok(rows.length > 10 && rows.includes(2000));
  });
});

describe("keys move focus by index", () => {
  it("by one, to either end, and by a page", () => {
    assert.equal(listStep("ArrowDown", 5, 10, 5000), 6);
    assert.equal(listStep("ArrowUp", 5, 10, 5000), 4);
    assert.equal(listStep("Home", 2500, 10, 5000), 0);
    assert.equal(listStep("End", 2500, 10, 5000), 4999);
    assert.equal(listStep("PageDown", 5, 10, 5000), 15);
    assert.equal(listStep("PageUp", 25, 10, 5000), 15);
  });

  it("clamp a page step at the ends, stop at them, and ignore other keys", () => {
    assert.equal(listStep("PageUp", 3, 10, 5000), 0);
    assert.equal(listStep("PageDown", 4995, 10, 5000), 4999);
    assert.equal(listStep("PageUp", 0, 10, 5000), null);
    assert.equal(listStep("ArrowDown", 4999, 10, 5000), null);
    assert.equal(listStep("a", 5, 10, 5000), null);
    assert.equal(listStep("PageDown", -1, 10, 5000), null);
    assert.equal(listStep("PageDown", 5, 0, 5000), 6, "a viewport of no rows still steps one");
  });

  it("count whole rows in a viewport", () => {
    assert.equal(rowsInView(360), 10);
    assert.equal(rowsInView(370), 10);
    assert.equal(rowsInView(0), 1);
  });
});

describe("a hidden list keeps its offset", () => {
  it("keeps the offset of a visible list and puts a lost one back", () => {
    assert.equal(restoredTop({ hidden: false, lastTop: 900 }, 1200), 1200);
    assert.equal(restoredTop({ hidden: true, lastTop: 9000 }, 0), 9000);
    assert.equal(restoredTop({ hidden: true, lastTop: 9000 }, 9000.5), 9000.5);
  });

  it("compares ranges by their rows", () => {
    assert.equal(sameRange({ first: 1, last: 4 }, { first: 1, last: 4 }), true);
    assert.equal(sameRange({ first: 1, last: 4 }, { first: 1, last: 5 }), false);
  });
});

describe("useRowWindow in a render with no scroller yet", () => {
  const probe = (count: number): string =>
    renderToStaticMarkup(
      createElement(() => {
        const win = useRowWindow({ scroller: null, count, resetKey: "a" });
        return createElement("p", { "data-windowed": String(win.windowed), "data-rows": win.indexes.length, "data-view": win.viewRows });
      }),
    );

  it("mounts every row of a list at or under 100 and a flat seed window above, requesting nothing", () => {
    assert.match(probe(80), /data-windowed="false" data-rows="80" data-view="0"/);
    assert.match(probe(100), /data-windowed="false" data-rows="100"/);
    const long = [101, 5000, 27000].map((count) => /data-rows="(\d+)"/.exec(probe(count))?.[1]);
    assert.equal(new Set(long).size, 1);
    assert.ok(Number(long[0]) > 0 && Number(long[0]) <= 16, `${long[0]} seed rows`);
    assert.match(probe(5000), /data-windowed="true"[^>]*data-view="0"/);
  });
});
