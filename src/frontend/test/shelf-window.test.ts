import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROWS_FIRST_WINDOW, ROWS_WINDOW_BUFFER } from "@/lib/library-limits";
import { MAX_UNSCROLLED_PAGES } from "@/lib/library-pager";
import {
  POSTER_MIN,
  SHELF_GAP,
  shelfPitch,
  shelfRange,
  shelfSegments,
  shelfWantsPage,
  withinHorizontalLookAhead,
  type ShelfPagerState,
} from "@/lib/shelf-window";

describe("shelf geometry", () => {
  it("fits six poster cards in the row, never under the grid's minimum", () => {
    assert.equal(shelfPitch(1200, false), 186 + SHELF_GAP);
    assert.equal(shelfPitch(600, false), POSTER_MIN + SHELF_GAP);
    assert.equal(shelfPitch(1200, true), 460.8 + SHELF_GAP);
    assert.equal(shelfPitch(0, false), 0);
    assert.equal(shelfPitch(20, false), 0);
  });
});

describe("horizontal windowing", () => {
  it("mounts the cards the view touches plus the buffer each side", () => {
    assert.equal(ROWS_WINDOW_BUFFER, 3);
    assert.deepEqual(shelfRange({ scrollLeft: 0, clientWidth: 1200 }, false, 400), { start: 0, end: 9 });
    assert.deepEqual(shelfRange({ scrollLeft: 1980, clientWidth: 1200 }, false, 400), { start: 6, end: 19 });
  });

  it("stays bounded however long the shelf and however far it is scrolled", () => {
    for (const scrollLeft of [0, 5000, 50_000, 79_000]) {
      const range = shelfRange({ scrollLeft, clientWidth: 1200 }, false, 400);
      assert.ok(range.end - range.start <= 6 + 1 + 2 * ROWS_WINDOW_BUFFER, `at ${scrollLeft}`);
      assert.ok(range.start >= 0 && range.end <= 400);
    }
  });

  it("clamps at both ends and handles a short or empty shelf", () => {
    assert.deepEqual(shelfRange({ scrollLeft: 99_999, clientWidth: 1200 }, false, 20), { start: 16, end: 20 });
    assert.deepEqual(shelfRange({ scrollLeft: 0, clientWidth: 1200 }, false, 4), { start: 0, end: 4 });
    assert.deepEqual(shelfRange({ scrollLeft: 0, clientWidth: 1200 }, false, 0), { start: 0, end: 0 });
  });

  it("mounts the first cards before the row is measured or while it has no width", () => {
    assert.deepEqual(shelfRange(null, false, 400), { start: 0, end: ROWS_FIRST_WINDOW });
    assert.deepEqual(shelfRange({ scrollLeft: 900, clientWidth: 0 }, false, 400), { start: 0, end: ROWS_FIRST_WINDOW });
  });
});

describe("shelf segments", () => {
  it("draws spacers for the cards before and after the range", () => {
    assert.deepEqual(shelfSegments({ start: 2, end: 4 }, null, 6), [
      { kind: "gap", cards: 2 }, { kind: "card", index: 2 }, { kind: "card", index: 3 }, { kind: "gap", cards: 2 },
    ]);
  });

  it("keeps a pinned card mounted outside the range, with the row's length unchanged", () => {
    const segments = shelfSegments({ start: 10, end: 12 }, 1, 20);
    assert.deepEqual(segments, [
      { kind: "gap", cards: 1 }, { kind: "card", index: 1 }, { kind: "gap", cards: 8 },
      { kind: "card", index: 10 }, { kind: "card", index: 11 }, { kind: "gap", cards: 8 },
    ]);
    const length = segments.reduce((sum, segment) => sum + (segment.kind === "gap" ? segment.cards : 1), 0);
    assert.equal(length, 20);
  });

  it("ignores a pin outside the shelf and draws no spacer at a full range", () => {
    assert.deepEqual(shelfSegments({ start: 0, end: 2 }, 9, 2), [{ kind: "card", index: 0 }, { kind: "card", index: 1 }]);
  });
});

describe("the shelf pager", () => {
  const row = { left: 0, right: 1200 };
  const near: ShelfPagerState = { hasMore: true, paging: false, rowWidth: 1200, inRange: true, unscrolled: 0 };

  it("sees the sentinel within the horizontal look-ahead, and never in a row without width", () => {
    assert.equal(withinHorizontalLookAhead({ left: 1500, right: 1500 }, row, 480), true);
    assert.equal(withinHorizontalLookAhead({ left: 1700, right: 1700 }, row, 480), false);
    assert.equal(withinHorizontalLookAhead({ left: 0, right: 0 }, { left: 0, right: 0 }, 480), false);
  });

  it("asks only when there is more, nothing is loading and the end is near", () => {
    assert.equal(shelfWantsPage(near), true);
    assert.equal(shelfWantsPage({ ...near, hasMore: false }), false);
    assert.equal(shelfWantsPage({ ...near, paging: true }), false);
    assert.equal(shelfWantsPage({ ...near, inRange: false }), false);
  });

  it("never asks while the row is hidden or has no size", () => {
    assert.equal(shelfWantsPage({ ...near, rowWidth: 0 }), false);
  });

  it("chains a bounded number of pages without the user scrolling", () => {
    assert.equal(shelfWantsPage({ ...near, unscrolled: MAX_UNSCROLLED_PAGES - 1 }), true);
    assert.equal(shelfWantsPage({ ...near, unscrolled: MAX_UNSCROLLED_PAGES }), false);
  });
});
