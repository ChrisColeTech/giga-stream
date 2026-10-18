import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIST_LAYOUT, listHeight, listRange, listStep, restoredTop, rowsInView, sameRange } from "../src/lib/list-window";
import {
  HEADER_HEIGHT, LIST_MIN_HEIGHT, LIST_PAGE_MARGIN, OVERSCAN_ROWS, ROW_HEIGHT, WINDOW_MIN_ROWS,
} from "../src/lib/window-constants";

const mounted = (range: { first: number; last: number }): number => range.last - range.first + 1;

describe("the record list's geometry (docs/41 4.1)", () => {
  it("is one column of 36px rows with no gap, and windows above 100 rows", () => {
    assert.deepEqual(LIST_LAYOUT, { columns: 1, rowHeight: 36, pitch: 36 });
    assert.equal(ROW_HEIGHT, 36);
    assert.equal(WINDOW_MIN_ROWS, 100);
    assert.equal(OVERSCAN_ROWS, 2);
  });
});

describe("listRange", () => {
  const height = 10 * 36;
  it("mounts a flat number of rows (the view, two of overscan each side) for 101, 5,000 and 27,000 rows", () => {
    for (const count of [101, 5000, 27000]) {
      assert.equal(mounted(listRange(40 * 36, height, count)), 10 + 2 * OVERSCAN_ROWS, `${count} rows`);
      assert.equal(mounted(listRange(0, height, count)), 10 + OVERSCAN_ROWS, `${count} rows at the top`);
    }
  });
  it("reaches the end of 27,000 rows and never answers an empty window", () => {
    assert.equal(listRange(27000 * 36, height, 27000).last, 26999);
    assert.ok(mounted(listRange(Number.NaN, height, 27000)) > 0);
    assert.ok(mounted(listRange(1e12, height, 27000)) > 0);
  });
});

describe("listHeight", () => {
  it("is the content's height when it fits", () => {
    assert.equal(listHeight(3, 1000), 3 * 36 + HEADER_HEIGHT);
  });
  it("is the page's height less the margin for a long list", () => {
    assert.equal(listHeight(5000, 1000), 1000 - LIST_PAGE_MARGIN);
    assert.equal(listHeight(5000, 640), 640 - LIST_PAGE_MARGIN);
  });
  it("never falls under the minimum, also while the page is unknown or hidden", () => {
    assert.equal(listHeight(5000, 0), LIST_MIN_HEIGHT);
    assert.equal(listHeight(5000, 200), LIST_MIN_HEIGHT);
  });
});

describe("listStep: focus moves by index", () => {
  it("moves by one, to either end, and by a page", () => {
    assert.equal(listStep("ArrowDown", 5, 10, 5000), 6);
    assert.equal(listStep("ArrowUp", 5, 10, 5000), 4);
    assert.equal(listStep("Home", 2500, 10, 5000), 0);
    assert.equal(listStep("End", 2500, 10, 5000), 4999);
    assert.equal(listStep("PageDown", 5, 10, 5000), 15);
    assert.equal(listStep("PageUp", 25, 10, 5000), 15);
  });
  it("clamps a page step at the ends and stops at them", () => {
    assert.equal(listStep("PageUp", 3, 10, 5000), 0);
    assert.equal(listStep("PageDown", 4995, 10, 5000), 4999);
    assert.equal(listStep("PageUp", 0, 10, 5000), null);
    assert.equal(listStep("PageDown", 4999, 10, 5000), null);
    assert.equal(listStep("ArrowDown", 4999, 10, 5000), null);
  });
  it("ignores other keys, sideways arrows' edges and a row outside the list", () => {
    assert.equal(listStep("a", 5, 10, 5000), null);
    assert.equal(listStep("PageDown", -1, 10, 5000), null);
    assert.equal(listStep("PageDown", 5, 0, 5000), 6, "a viewport of no rows still steps one");
  });
  it("counts whole rows in a viewport", () => {
    assert.equal(rowsInView(360), 10);
    assert.equal(rowsInView(370), 10);
    assert.equal(rowsInView(0), 1);
  });
});

describe("restoredTop: a hidden list keeps its offset", () => {
  it("keeps the offset of a visible list", () => {
    assert.equal(restoredTop({ hidden: false, lastTop: 900 }, 1200), 1200);
  });
  it("puts the last offset back when a hidden list is shown with its offset lost", () => {
    assert.equal(restoredTop({ hidden: true, lastTop: 9000 }, 0), 9000);
    assert.equal(restoredTop({ hidden: true, lastTop: 9000 }, 9000.5), 9000.5);
  });
  it("compares ranges by their rows", () => {
    assert.equal(sameRange({ first: 1, last: 4 }, { first: 1, last: 4 }), true);
    assert.equal(sameRange({ first: 1, last: 4 }, { first: 1, last: 5 }), false);
  });
});
