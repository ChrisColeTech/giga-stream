import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseLine, sidesFalling, sidesRising } from "../src/panes/pane-collapse";
import type { PaneTable } from "../src/panes/pane-types";

/* A table of the engine's own: a wide surface with all three panes, one with a left pane only (the admin's shape), and
   one with a right pane only. The program's numbers are tested where the program's table lives. */
const TABLE: PaneTable = {
  wide: {
    centerMin: 520,
    panes: {
      left: { min: 240, max: 420, preferred: 288 },
      right: { min: 288, max: 480, preferred: 344 },
      bottom: { min: 148, max: 280, preferred: 188 },
    },
  },
  list: { centerMin: 480, panes: { left: { min: 200, max: 360, preferred: 240 }, right: null, bottom: null } },
  aside: { centerMin: 400, panes: { left: null, right: { min: 260, max: 440, preferred: 320 }, bottom: null } },
};

describe("the pane collapse line (06 section 1.3)", () => {
  it("drops the right pane first, once the work width is under 1000 px", () => {
    assert.equal(collapseLine(TABLE, "wide", "right"), 1000);
    assert.deepEqual(sidesFalling(TABLE, "wide", null, 1200), []);
    assert.deepEqual(sidesFalling(TABLE, "wide", 1200, 990), ["right"]);
  });

  it("drops the left pane only when the centre and the left pane no longer fit side by side", () => {
    assert.equal(collapseLine(TABLE, "wide", "left"), 520 + 240);
    assert.equal(collapseLine(TABLE, "list", "left"), 480 + 200);
    assert.deepEqual(sidesFalling(TABLE, "wide", 900, 750), ["left"]);
    assert.deepEqual(sidesFalling(TABLE, "wide", 900, 800), []);
  });

  it("takes both side panes when the width jumps under both lines, right first", () => {
    assert.deepEqual(sidesFalling(TABLE, "wide", 1400, 700), ["right", "left"]);
  });

  it("does not collapse a pane again while the width stays under its line", () => {
    assert.deepEqual(sidesFalling(TABLE, "wide", 900, 880), []);
    assert.deepEqual(sidesFalling(TABLE, "wide", 700, 650), []);
  });

  it("collapses on the first measure when the surface is already under its line", () => {
    assert.deepEqual(sidesFalling(TABLE, "wide", null, 900), ["right"]);
  });

  it("never returns the bottom pane or the centre: the width rule is for the side panes only", () => {
    assert.deepEqual(sidesFalling(TABLE, "wide", 1200, 500), ["right", "left"]);
  });

  it("leaves out a side the surface does not have", () => {
    assert.deepEqual(sidesFalling(TABLE, "list", 1200, 300), ["left"]);
    assert.deepEqual(sidesFalling(TABLE, "aside", 1200, 300), ["right"]);
    assert.deepEqual(sidesRising(TABLE, "list", 300, 1200), ["left"]);
    assert.deepEqual(sidesFalling(TABLE, "missing", 1200, 300), []);
  });

  it("raises a side pane when the width crosses its line upward, and never on the first measure", () => {
    assert.deepEqual(sidesRising(TABLE, "wide", 990, 1200), ["right"]);
    assert.deepEqual(sidesRising(TABLE, "wide", 700, 1200), ["right", "left"]);
    assert.deepEqual(sidesRising(TABLE, "wide", 1100, 1200), []);
    assert.deepEqual(sidesRising(TABLE, "wide", null, 1200), []);
  });
});
