import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rowEnds, rowStep, scrollStep } from "@/components/library/rows/rows-navigation";

/* Three shelves of 4, 1 and 3 cards. */
const SHELVES = [4, 1, 3];

describe("rowStep across a row", () => {
  it("moves one card left and right, and stops at the row's ends", () => {
    assert.deepEqual(rowStep("ArrowRight", { shelf: 0, card: 1 }, SHELVES), { shelf: 0, card: 2 });
    assert.deepEqual(rowStep("ArrowLeft", { shelf: 0, card: 1 }, SHELVES), { shelf: 0, card: 0 });
    assert.equal(rowStep("ArrowLeft", { shelf: 0, card: 0 }, SHELVES), null);
    assert.equal(rowStep("ArrowRight", { shelf: 0, card: 3 }, SHELVES), null);
  });

  it("jumps to the first and last card of the row with Home and End", () => {
    assert.deepEqual(rowStep("Home", { shelf: 0, card: 2 }, SHELVES), { shelf: 0, card: 0 });
    assert.deepEqual(rowStep("End", { shelf: 2, card: 0 }, SHELVES), { shelf: 2, card: 2 });
    assert.equal(rowStep("Home", { shelf: 0, card: 0 }, SHELVES), null);
    assert.equal(rowStep("End", { shelf: 0, card: 3 }, SHELVES), null);
  });
});

describe("rowStep between shelves", () => {
  it("moves to the same card index on the next or previous shelf", () => {
    assert.deepEqual(rowStep("ArrowDown", { shelf: 0, card: 0 }, SHELVES), { shelf: 1, card: 0 });
    assert.deepEqual(rowStep("ArrowUp", { shelf: 2, card: 2 }, SHELVES), { shelf: 1, card: 0 });
  });

  it("lands on the last card of a shorter shelf", () => {
    assert.deepEqual(rowStep("ArrowDown", { shelf: 0, card: 3 }, SHELVES), { shelf: 1, card: 0 });
    assert.deepEqual(rowStep("ArrowDown", { shelf: 2, card: 2 }, SHELVES), null);
  });

  it("stops at the first and last shelf", () => {
    assert.equal(rowStep("ArrowUp", { shelf: 0, card: 1 }, SHELVES), null);
    assert.equal(rowStep("ArrowDown", { shelf: 2, card: 1 }, SHELVES), null);
  });
});

describe("rowStep for keys and positions it does not handle", () => {
  it("does nothing for an unknown key, or with no card in focus", () => {
    assert.equal(rowStep("a", { shelf: 0, card: 1 }, SHELVES), null);
    assert.equal(rowStep("ArrowRight", { shelf: 0, card: -1 }, SHELVES), null);
    assert.equal(rowStep("ArrowRight", { shelf: 5, card: 0 }, SHELVES), null);
    assert.equal(rowStep("ArrowRight", { shelf: 0, card: 0 }, []), null);
  });
});

describe("rowEnds", () => {
  it("reports the start when the row is scrolled to zero", () => {
    assert.deepEqual(rowEnds({ scrollLeft: 0, clientWidth: 300, scrollWidth: 900 }), { atStart: true, atEnd: false });
  });

  it("reports the end within a pixel of the far edge", () => {
    const near = { scrollLeft: 599.5, clientWidth: 300, scrollWidth: 900 };
    assert.deepEqual(rowEnds(near), { atStart: false, atEnd: true });
  });

  it("reports both ends when the row fits without scrolling", () => {
    assert.deepEqual(rowEnds({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 }), { atStart: true, atEnd: true });
  });
});

describe("scrollStep", () => {
  it("scrolls by four fifths of the visible width, rounded", () => {
    assert.equal(scrollStep(500), 400);
    assert.equal(scrollStep(333), 266);
  });
});
