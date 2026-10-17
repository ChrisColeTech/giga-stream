import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseLine, sidesFalling, sidesRising } from "@/lib/pane-collapse";

describe("the pane collapse line (06 section 1.3)", () => {
  it("drops the right pane first, once the work width is under 1000 px", () => {
    assert.equal(collapseLine("library", "right"), 1000);
    assert.deepEqual(sidesFalling("library", null, 1200), []);
    assert.deepEqual(sidesFalling("library", 1200, 990), ["right"]);
  });

  it("drops the left pane only when the centre and the left pane no longer fit side by side", () => {
    assert.equal(collapseLine("library", "left"), 520 + 248);
    assert.equal(collapseLine("live", "left"), 480 + 240);
    assert.deepEqual(sidesFalling("library", 900, 760), ["left"]);
    assert.deepEqual(sidesFalling("library", 900, 800), []);
  });

  it("takes both side panes when the width jumps under both lines, right first", () => {
    assert.deepEqual(sidesFalling("live", 1400, 700), ["right", "left"]);
  });

  it("does not collapse a pane again while the width stays under its line", () => {
    assert.deepEqual(sidesFalling("library", 900, 880), []);
    assert.deepEqual(sidesFalling("library", 700, 650), []);
  });

  it("collapses on the first measure when the surface is already under its line", () => {
    assert.deepEqual(sidesFalling("player", null, 900), ["right"]);
  });

  it("never returns the bottom pane or the centre: the width rule is for the side panes only", () => {
    assert.deepEqual(sidesFalling("player", 1200, 500), ["right", "left"]);
  });

  it("raises a side pane when the width crosses its line upward, and never on the first measure", () => {
    assert.deepEqual(sidesRising("library", 990, 1200), ["right"]);
    assert.deepEqual(sidesRising("library", 700, 1200), ["right", "left"]);
    assert.deepEqual(sidesRising("library", 1100, 1200), []);
    assert.deepEqual(sidesRising("library", null, 1200), []);
  });
});
