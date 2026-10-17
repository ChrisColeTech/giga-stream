import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POPUP_CLASSES, POPUP_EDGE } from "../src/lib/popup-metrics";
import { clampToWindow, hangY } from "../src/lib/popup-place";

describe("popup size classes", () => {
  it("are 242, 460 and 602 wide with body caps of 240, 400 and 500", () => {
    assert.deepEqual(POPUP_CLASSES.compact, { width: 242, body: 240 });
    assert.deepEqual(POPUP_CLASSES.standard, { width: 460, body: 400 });
    assert.deepEqual(POPUP_CLASSES.wide, { width: 602, body: 500 });
  });
});

describe("popup placement", () => {
  it("leaves a panel that fits where it was asked to go", () => {
    assert.deepEqual(clampToWindow(100, 120, 260, 200, 1600, 1000), { x: 100, y: 120 });
  });

  it("nudges a panel back inside every window edge", () => {
    assert.deepEqual(clampToWindow(-50, -50, 260, 200, 1600, 1000), { x: POPUP_EDGE, y: POPUP_EDGE });
    assert.deepEqual(clampToWindow(1500, 900, 260, 200, 1600, 1000), {
      x: 1600 - 260 - POPUP_EDGE,
      y: 1000 - 200 - POPUP_EDGE,
    });
  });

  it("hangs under a control when there is room, and over it when there is not", () => {
    assert.equal(hangY(100, 128, 124, 1000), 132);
    assert.equal(hangY(960, 988, 124, 1000), 960 - 4 - 124);
  });

  it("stays under a control that has no room either way", () => {
    assert.equal(hangY(40, 68, 900, 700), 72);
  });

  it("pins a panel larger than the window to the near edge instead of going negative", () => {
    const at = clampToWindow(300, 300, 2000, 2000, 800, 600);
    assert.equal(at.x, POPUP_EDGE);
    assert.equal(at.y, POPUP_EDGE);
  });
});
