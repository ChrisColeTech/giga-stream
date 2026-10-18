import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROWS_COPY } from "@/components/library/rows/rows-constants";
import {
  backChevron,
  cardStep,
  forwardChevron,
  forwardNeedsPage,
  nearestCard,
  rowEnds,
  scrollStep,
} from "@/components/library/rows/rows-navigation";

describe("cardStep within a shelf", () => {
  it("moves one card left and right by index, and stops at the loaded ends", () => {
    assert.equal(cardStep("ArrowRight", 1, 40), 2);
    assert.equal(cardStep("ArrowLeft", 1, 40), 0);
    assert.equal(cardStep("ArrowLeft", 0, 40), null);
    assert.equal(cardStep("ArrowRight", 39, 40), null);
  });

  it("goes to the first and last loaded card with Home and End, mounted or not", () => {
    assert.equal(cardStep("Home", 25, 40), 0);
    assert.equal(cardStep("End", 2, 40), 39);
    assert.equal(cardStep("Home", 0, 40), null);
    assert.equal(cardStep("End", 39, 40), null);
  });

  it("does nothing for other keys or a position outside the shelf", () => {
    assert.equal(cardStep("ArrowUp", 1, 40), null);
    assert.equal(cardStep("a", 1, 40), null);
    assert.equal(cardStep("ArrowRight", -1, 40), null);
    assert.equal(cardStep("ArrowRight", 0, 0), null);
  });
});

describe("nearestCard between shelves", () => {
  it("lands on the card whose left edge is closest", () => {
    assert.equal(nearestCard([12, 216, 420, 624], 400), 2);
    assert.equal(nearestCard([12, 216], 9000), 1);
    assert.equal(nearestCard([], 10), -1);
  });
});

describe("rowEnds", () => {
  it("reports the start, the end within a pixel, and both when the row fits", () => {
    assert.deepEqual(rowEnds({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }), { atStart: true, atEnd: false });
    assert.deepEqual(rowEnds({ scrollLeft: 599.5, clientWidth: 300, scrollWidth: 900 }), { atStart: false, atEnd: true });
    assert.deepEqual(rowEnds({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }), { atStart: true, atEnd: true });
  });
});

describe("the Scroll right rule", () => {
  const fits = { atStart: true, atEnd: true };
  const beyond = { atStart: true, atEnd: false };

  it("is enabled while loaded cards lie beyond the view, even with no next page", () => {
    assert.deepEqual(forwardChevron(beyond, false), { disabled: false, title: ROWS_COPY.scrollForward });
  });

  it("is enabled while the server has a next page, even when every loaded card fits (the owner's report)", () => {
    assert.deepEqual(forwardChevron(fits, true), { disabled: false, title: ROWS_COPY.scrollForward });
  });

  it("is disabled with its reason only at the true end", () => {
    assert.deepEqual(forwardChevron(fits, false), { disabled: true, title: ROWS_COPY.atEnd });
  });

  it("Scroll left is disabled with its reason at the start only", () => {
    assert.deepEqual(backChevron(fits), { disabled: true, title: ROWS_COPY.atStart });
    assert.deepEqual(backChevron({ atStart: false, atEnd: true }), { disabled: false, title: ROWS_COPY.scrollBack });
  });
});

describe("a Scroll right press", () => {
  it("scrolls one row width", () => {
    assert.equal(scrollStep(1200), 1200);
    assert.equal(scrollStep(333.4), 333);
  });

  it("asks for the next page at once when the step brings the end within a row width", () => {
    assert.equal(forwardNeedsPage({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 2900 }, true), true);
    assert.equal(forwardNeedsPage({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 3100 }, true), false);
    assert.equal(forwardNeedsPage({ scrollLeft: 0, clientWidth: 1000, scrollWidth: 1000 }, false), false);
  });
});
