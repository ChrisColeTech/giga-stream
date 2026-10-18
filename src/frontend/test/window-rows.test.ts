import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GRID_SPEC, LIST_SPEC } from "@/constants/library-window";
import {
  anchorOf, gridStep, nonEmptyRange, resetsToTop, rowCount, rowLayout, scrollTopForAnchor, scrollTopToReveal,
  visibleRows, windowSegments,
} from "@/lib/window-rows";

/** CSS `repeat(auto-fill, minmax(144px, 1fr))` with a 12px gap: the columns the browser makes of `width`. */
const cssColumns = (width: number): number => {
  let columns = 1;
  while ((columns + 1) * 144 + columns * 12 <= width) columns += 1;
  return columns;
};
const heightOf = (segments: ReturnType<typeof windowSegments>, pitch: number): number =>
  segments.reduce((sum, segment) => sum + (segment.kind === "gap" ? segment.height : pitch), 0);

describe("rowLayout", () => {
  it("makes the columns CSS auto-fill makes, at every width", () => {
    for (let width = 100; width <= 4000; width += 7) {
      assert.equal(rowLayout(width, GRID_SPEC).columns, cssColumns(width), `width ${width}`);
    }
  });

  it("sizes a row from the card's width: 2:3 art plus the chrome, and a gap", () => {
    const layout = rowLayout(1476, GRID_SPEC);
    assert.equal(layout.columns, 9);
    const card = (1476 - 8 * 12) / 9;
    assert.equal(layout.rowHeight, Math.ceil(card * 1.5 + 52));
    assert.equal(layout.pitch, layout.rowHeight + 12);
  });

  it("keeps one column and a fixed height in the list, whatever the width", () => {
    for (const width of [0, 200, 3000]) {
      const layout = rowLayout(width, LIST_SPEC);
      assert.deepEqual(layout, { columns: 1, rowHeight: 68, pitch: 72 });
    }
  });

  it("never yields zero columns", () => {
    assert.equal(rowLayout(0, GRID_SPEC).columns, 1);
    assert.equal(rowLayout(50, GRID_SPEC).columns, 1);
  });
});

describe("visibleRows", () => {
  const layout = { columns: 4, rowHeight: 88, pitch: 100 };
  it("covers the viewport and widens it by the overscan", () => {
    assert.deepEqual(visibleRows({ top: 1000, height: 300 }, layout, 100, 0), { first: 10, last: 12 });
    assert.deepEqual(visibleRows({ top: 1000, height: 300 }, layout, 100, 2), { first: 8, last: 14 });
  });

  it("clamps at both ends", () => {
    assert.deepEqual(visibleRows({ top: 0, height: 300 }, layout, 100, 2), { first: 0, last: 4 });
    assert.deepEqual(visibleRows({ top: 9700, height: 300 }, layout, 100, 2), { first: 95, last: 99 });
    assert.deepEqual(visibleRows({ top: 99999, height: 300 }, layout, 100, 2), { first: 97, last: 99 });
  });

  it("starts at the first row while the viewport is still above the rows", () => {
    assert.deepEqual(visibleRows({ top: -250, height: 300 }, layout, 100, 0), { first: 0, last: 0 });
  });

  it("is empty with no rows", () => {
    assert.ok(visibleRows({ top: 0, height: 300 }, layout, 0, 2).last < 0);
  });

  it("bounds the rows mounted by the window, not by how many exist", () => {
    for (const rows of [50, 5000, 7000]) {
      const range = visibleRows({ top: 20 * 100, height: 800 }, layout, rows, 2);
      assert.equal(range.last - range.first + 1, 8 + 4);
    }
  });
});

describe("windowSegments", () => {
  const layout = { columns: 4, rowHeight: 88, pitch: 100 };
  it("fills the rest with gaps so the height is rows * pitch", () => {
    const segments = windowSegments({ first: 3, last: 5 }, null, 20, layout);
    assert.deepEqual(segments.map((segment) => segment.kind === "gap" ? segment.height : segment.index),
      [300, 3, 4, 5, 1400]);
    assert.equal(heightOf(segments, layout.pitch), 2000);
  });

  it("draws no gap at the edges", () => {
    const segments = windowSegments({ first: 0, last: 19 }, null, 20, layout);
    assert.equal(segments.every((segment) => segment.kind === "row"), true);
  });

  it("keeps a pinned row outside the range, with a gap each side", () => {
    const above = windowSegments({ first: 10, last: 12 }, 2, 30, layout);
    assert.deepEqual(above.map((segment) => segment.kind === "gap" ? segment.height : segment.index),
      [200, 2, 700, 10, 11, 12, 1700]);
    const below = windowSegments({ first: 10, last: 12 }, 25, 30, layout);
    assert.equal(heightOf(below, layout.pitch), 3000);
    assert.equal(below.filter((segment) => segment.kind === "row").length, 4);
  });

  it("ignores a pin inside the range or out of bounds", () => {
    const inside = windowSegments({ first: 10, last: 12 }, 11, 30, layout);
    assert.equal(inside.filter((segment) => segment.kind === "row").length, 3);
    const outside = windowSegments({ first: 10, last: 12 }, 40, 30, layout);
    assert.equal(outside.filter((segment) => segment.kind === "row").length, 3);
  });
});

describe("anchor", () => {
  it("keeps the first visible item first when the columns change", () => {
    const wide = rowLayout(1476, GRID_SPEC);
    const narrow = rowLayout(700, GRID_SPEC);
    const gridTop = 140;
    const scrollTop = gridTop + 40 * wide.pitch + wide.pitch / 4;
    const anchor = anchorOf(scrollTop - gridTop, wide);
    assert.ok(anchor !== null);
    assert.equal(anchor.index, 40 * wide.columns);
    const back = scrollTopForAnchor(anchor, narrow, gridTop);
    const row = Math.floor((back - gridTop) / narrow.pitch);
    assert.equal(row, Math.floor(anchor.index / narrow.columns));
  });

  it("round-trips to the same offset when the layout is unchanged", () => {
    const layout = rowLayout(1000, GRID_SPEC);
    const anchor = anchorOf(12345, layout);
    assert.ok(anchor !== null);
    assert.ok(Math.abs(scrollTopForAnchor(anchor, layout, 0) - 12345) <= 1);
  });

  it("holds nothing while the viewport is above the rows", () => {
    assert.equal(anchorOf(-1, rowLayout(1000, GRID_SPEC)), null);
  });
});

describe("scrollTopToReveal", () => {
  const layout = { columns: 4, rowHeight: 88, pitch: 100 };
  const view = { top: 1000, height: 400 };
  it("leaves a row that is already visible", () => {
    assert.equal(scrollTopToReveal(4 * 11, layout, view, 0), 1000);
  });

  it("brings a row below to the bottom edge and a row above to the top edge", () => {
    assert.equal(scrollTopToReveal(4 * 20, layout, view, 0), 2000 + 88 - 400);
    assert.equal(scrollTopToReveal(4 * 3, layout, view, 0), 300);
  });

  it("counts the height above the first row", () => {
    assert.equal(scrollTopToReveal(0, layout, { top: 500, height: 400 }, 140), 140);
  });
});

describe("gridStep", () => {
  it("moves by one, by a row, and to either end", () => {
    assert.equal(gridStep("ArrowRight", 5, 4, 30), 6);
    assert.equal(gridStep("ArrowLeft", 5, 4, 30), 4);
    assert.equal(gridStep("ArrowDown", 5, 4, 30), 9);
    assert.equal(gridStep("ArrowUp", 5, 4, 30), 1);
    assert.equal(gridStep("Home", 5, 4, 30), 0);
    assert.equal(gridStep("End", 5, 4, 30), 29);
  });

  it("stops at the edges and on a ragged last row", () => {
    assert.equal(gridStep("ArrowLeft", 0, 4, 30), null);
    assert.equal(gridStep("ArrowUp", 2, 4, 30), null);
    assert.equal(gridStep("ArrowRight", 29, 4, 30), null);
    assert.equal(gridStep("ArrowDown", 27, 4, 30), null);
    assert.equal(gridStep("End", 29, 4, 30), null);
  });

  it("does nothing for other keys or no focused card", () => {
    assert.equal(gridStep("a", 5, 4, 30), null);
    assert.equal(gridStep("ArrowDown", -1, 4, 30), null);
    assert.equal(gridStep("ArrowDown", 0, 1, 0), null);
  });

  it("is a column in the list", () => {
    assert.equal(gridStep("ArrowDown", 3, 1, 10), 4);
    assert.equal(gridStep("ArrowUp", 3, 1, 10), 2);
  });
});

describe("a stale or oversized offset (a scroll position carried over from another list)", () => {
  const layout = rowLayout(1476, GRID_SPEC);
  it("clamps to the last rows when the offset is past the content height", () => {
    const range = visibleRows({ top: 3373 + 1e6, height: 900 }, layout, 40, 3);
    assert.equal(range.last, 39);
    assert.ok(range.first >= 36 && range.first <= 39);
  });
  it("treats a negative or non-finite offset as the top", () => {
    assert.equal(visibleRows({ top: -5000, height: 900 }, layout, 40, 3).first, 0);
    assert.equal(visibleRows({ top: Number.NaN, height: 900 }, layout, 40, 3).first, 0);
  });
  it("never answers an empty window for a non-empty list", () => {
    for (const top of [0, 1, 3373, 25824, 1e9, -1e9, Number.NaN, Infinity]) {
      const range = visibleRows({ top, height: 900 }, layout, 17, 3);
      assert.ok(range.last >= range.first && range.first >= 0 && range.last <= 16, `top ${top}`);
    }
  });
});

describe("nonEmptyRange", () => {
  it("keeps a sound range and an empty list empty", () => {
    assert.deepEqual(nonEmptyRange({ first: 2, last: 5 }, 10), { first: 2, last: 5 });
    assert.deepEqual(nonEmptyRange({ first: 2, last: 5 }, 0), { first: 0, last: -1 });
  });
  it("moves a range past the end to the last rows, and an inverted one to the first rows", () => {
    assert.deepEqual(nonEmptyRange({ first: 50, last: 54 }, 10), { first: 5, last: 9 });
    assert.deepEqual(nonEmptyRange({ first: 4, last: 3 }, 10), { first: 0, last: 0 });
    assert.deepEqual(nonEmptyRange({ first: -3, last: -1 }, 10), { first: 0, last: 2 });
  });
});

describe("resetsToTop", () => {
  it("resets on every view switch, in any direction, and on the first mount", () => {
    const views = ["rows", "grid", "list"];
    for (const from of views) {
      for (const to of views) assert.equal(resetsToTop({ loading: false, view: to, previousView: from }), from !== to);
    }
    assert.equal(resetsToTop({ loading: false, view: "grid", previousView: null }), true);
  });
  it("resets while a first page reads, and keeps the position when the tab is shown again", () => {
    assert.equal(resetsToTop({ loading: true, view: "grid", previousView: "grid" }), true);
    assert.equal(resetsToTop({ loading: false, view: "grid", previousView: "grid" }), false);
  });
});

describe("rowCount", () => {
  it("rounds up", () => {
    assert.equal(rowCount(27000, 9), 3000);
    assert.equal(rowCount(27001, 9), 3001);
    assert.equal(rowCount(0, 9), 0);
  });
});
