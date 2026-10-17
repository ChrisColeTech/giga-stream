import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cardStep } from "@/lib/library-keys";

/* Three columns: the first row's cards share a top edge, the second row's share another. */
const GRID = [0, 0, 0, 100, 100];

describe("cardStep", () => {
  it("moves one card left and right, and stops at the ends", () => {
    assert.equal(cardStep("ArrowRight", 1, GRID), 2);
    assert.equal(cardStep("ArrowLeft", 1, GRID), 0);
    assert.equal(cardStep("ArrowLeft", 0, GRID), null);
    assert.equal(cardStep("ArrowRight", 4, GRID), null);
  });

  it("moves a row up and down by the column count", () => {
    assert.equal(cardStep("ArrowDown", 0, GRID), 3);
    assert.equal(cardStep("ArrowUp", 4, GRID), 1);
    assert.equal(cardStep("ArrowUp", 1, GRID), null);
  });

  it("jumps to the first and last card with Home and End", () => {
    assert.equal(cardStep("Home", 3, GRID), 0);
    assert.equal(cardStep("End", 1, GRID), 4);
    assert.equal(cardStep("End", 4, GRID), null);
  });

  it("does nothing for an unknown key or no focused card", () => {
    assert.equal(cardStep("a", 1, GRID), null);
    assert.equal(cardStep("ArrowRight", -1, GRID), null);
    assert.equal(cardStep("ArrowRight", 0, []), null);
  });
});
