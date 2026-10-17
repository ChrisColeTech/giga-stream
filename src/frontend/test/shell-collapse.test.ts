import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseLine, sidesFalling, sidesRising } from "@giga/ui/panes/pane-collapse";
import { SURFACES } from "@/constants/surfaces";

/* The width rule itself is the library's (`shared/ui/test/pane-collapse.test.ts`); this pins it to the interface's
   three surfaces, so a change to the table that moves a collapse line is seen here. */
describe("the pane collapse line over the interface's surfaces (06 section 1.3)", () => {
  it("drops the right pane first, once the work width is under 1000 px", () => {
    assert.equal(collapseLine(SURFACES, "library", "right"), 1000);
    assert.deepEqual(sidesFalling(SURFACES, "library", null, 1200), []);
    assert.deepEqual(sidesFalling(SURFACES, "library", 1200, 990), ["right"]);
  });

  it("drops the left pane where the centre and the left pane no longer fit side by side", () => {
    assert.equal(collapseLine(SURFACES, "library", "left"), 520 + 248);
    assert.equal(collapseLine(SURFACES, "live", "left"), 480 + 240);
    assert.equal(collapseLine(SURFACES, "player", "left"), 520 + 240);
    assert.deepEqual(sidesFalling(SURFACES, "library", 900, 760), ["left"]);
    assert.deepEqual(sidesFalling(SURFACES, "library", 900, 800), []);
  });

  it("takes both side panes when the width jumps under both lines, right first", () => {
    assert.deepEqual(sidesFalling(SURFACES, "live", 1400, 700), ["right", "left"]);
    assert.deepEqual(sidesFalling(SURFACES, "player", 1200, 500), ["right", "left"]);
  });

  it("collapses on the first measure when the surface is already under its line", () => {
    assert.deepEqual(sidesFalling(SURFACES, "player", null, 900), ["right"]);
  });

  it("raises a side pane when the width crosses its line upward, and never on the first measure", () => {
    assert.deepEqual(sidesRising(SURFACES, "library", 990, 1200), ["right"]);
    assert.deepEqual(sidesRising(SURFACES, "library", 700, 1200), ["right", "left"]);
    assert.deepEqual(sidesRising(SURFACES, "library", null, 1200), []);
  });
});
