import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { usePaneOpen } from "../src/hooks/usePaneOpen";
import { usePaneTween } from "../src/hooks/usePaneTween";
import { limitsOf, limitsOfKey, paneKey, surfaceOf } from "../src/panes/pane-limits";
import { maxAllowed, minAllowed, near, restingSize } from "../src/panes/pane-tween-state";
import type { PaneEngine, PaneHost, PaneHostState, PaneKey, PaneTable, PaneTweenApi } from "../src/panes/pane-types";

const TABLE: PaneTable = {
  shown: {
    centerMin: 520,
    panes: {
      left: { min: 240, max: 420, preferred: 288 },
      right: { min: 288, max: 480, preferred: 344 },
      bottom: null,
    },
  },
  list: { centerMin: 480, panes: { left: { min: 200, max: 360, preferred: 240 }, right: null, bottom: null } },
};

/** A store a test holds in a variable: the whole `PaneHost` contract (state in, no one to tell). */
function fakeHost(initial: Partial<PaneHostState> = {}): { host: PaneHost } {
  const state: PaneHostState = {
    surface: "shown",
    open: {},
    sizes: {},
    openVersion: 0,
    togglePane: () => undefined,
    say: () => undefined,
    commitSizes: () => undefined,
    ...initial,
  };
  return { host: { getState: () => state, subscribe: () => () => undefined } };
}

/** Render a component that calls the engine's hook once, and hand back what the hook returned. */
function tweenOf(engine: PaneEngine, keys: readonly PaneKey[]): PaneTweenApi {
  const found: PaneTweenApi[] = [];
  function Probe() {
    found.push(usePaneTween(engine, keys, () => undefined));
    return null;
  }
  renderToStaticMarkup(<Probe />);
  const api = found[0];
  assert.ok(api !== undefined);
  return api;
}

describe("a limits table", () => {
  it("answers min, max and preferred per pane, and the centre's floor per surface", () => {
    assert.deepEqual(limitsOf(TABLE, "shown", "left"), { min: 240, max: 420, preferred: 288 });
    assert.deepEqual(limitsOf(TABLE, "shown", "right"), { min: 288, max: 480, preferred: 344 });
    assert.equal(surfaceOf(TABLE, "shown").centerMin, 520);
    assert.equal(surfaceOf(TABLE, "list").centerMin, 480);
  });

  it("has no entry for a pane a surface does not have, nor for a surface it does not know", () => {
    assert.equal(limitsOf(TABLE, "shown", "bottom"), null);
    assert.equal(limitsOf(TABLE, "list", "right"), null);
    assert.equal(limitsOf(TABLE, "missing", "left"), null);
    assert.equal(surfaceOf(TABLE, "missing").centerMin, 0);
  });

  it("is read by key: a surface and a side joined by a dot", () => {
    assert.equal(paneKey("shown", "left"), "shown.left");
    assert.deepEqual(limitsOfKey(TABLE, "shown.right"), { min: 288, max: 480, preferred: 344 });
    assert.deepEqual(limitsOfKey(TABLE, "list.right"), { min: 0, max: 0, preferred: 0 });
    assert.deepEqual(limitsOfKey(TABLE, "list.sideways"), { min: 0, max: 0, preferred: 0 });
    assert.deepEqual(limitsOfKey(TABLE, "missing.left"), { min: 0, max: 0, preferred: 0 });
  });
});

describe("the tween engine's pure parts", () => {
  const limits = { min: 240, max: 420, preferred: 288 };

  it("rests a pane at its committed size, else its preferred one, and at nothing while closed", () => {
    const open = { "shown.left": true, "shown.right": false };
    assert.deepEqual(restingSize({ open, sizes: { "shown.left": 300 } }, TABLE, "shown.left"), { committed: 300, value: 300 });
    assert.deepEqual(restingSize({ open, sizes: {} }, TABLE, "shown.left"), { committed: 288, value: 288 });
    assert.deepEqual(restingSize({ open, sizes: {} }, TABLE, "shown.right"), { committed: 344, value: 0 });
    assert.deepEqual(restingSize({ open: {}, sizes: {} }, TABLE, "shown.left"), { committed: 288, value: 0 });
  });

  it("holds the minimum only for a pane that is open, at rest and painted at least that wide", () => {
    assert.equal(minAllowed(limits, true, false, 288), 240);
    assert.equal(minAllowed(limits, true, true, 288), 0, "lifted for the length of a tween");
    assert.equal(minAllowed(limits, true, false, 100), 0, "a reopening pane travels up from nothing");
    assert.equal(minAllowed(limits, false, false, 288), 0);
    assert.equal(minAllowed(limits, undefined, false, 288), 0);
  });

  it("holds the maximum while a pane is open or travelling, and nothing once it is closed", () => {
    assert.equal(maxAllowed(limits, true, false), 420);
    assert.equal(maxAllowed(limits, false, true), 420, "a closing pane keeps its room until it has travelled");
    assert.equal(maxAllowed(limits, false, false), 0, "a closed pane's sash cannot drag it open");
    assert.equal(maxAllowed(limits, undefined, false), 0);
  });

  it("calls two layouts the same when every size is within a pixel", () => {
    assert.equal(near([288, 600, 344], [288.5, 599.5, 344]), true);
    assert.equal(near([288, 600], [290, 600]), false);
    assert.equal(near([288], [288, 600]), false);
  });
});

describe("usePaneTween over a PaneHost", () => {
  const keys = ["shown.left", "shown.right"];

  it("paints an open pane at its committed size and a closed one at nothing", () => {
    const { host } = fakeHost({ open: { "shown.left": true, "shown.right": false }, sizes: { "shown.left": 310 } });
    const tween = tweenOf({ host, table: TABLE, stageMin: 240 }, keys);
    assert.equal(tween.paintOf("shown.left"), 310);
    assert.equal(tween.paintOf("shown.right"), 0);
    assert.equal(tween.paintOf("shown.bottom"), 0, "a key it does not hold paints nothing");
  });

  it("starts a pane with no committed size at its preferred size", () => {
    const { host } = fakeHost({ open: { "shown.left": true, "shown.right": true } });
    const tween = tweenOf({ host, table: TABLE, stageMin: 240 }, keys);
    assert.equal(tween.paintOf("shown.left"), 288);
    assert.equal(tween.paintOf("shown.right"), 344);
  });

  it("lets Allotment clamp an open pane to its limits and a closed one to nothing, as the host says", () => {
    const { host } = fakeHost({ open: { "shown.left": true, "shown.right": false }, sizes: { "shown.left": 310 } });
    const tween = tweenOf({ host, table: TABLE, stageMin: 240 }, keys);
    assert.equal(tween.minFor("shown.left"), 240);
    assert.equal(tween.maxFor("shown.left"), 420);
    assert.equal(tween.minFor("shown.right"), 0);
    assert.equal(tween.maxFor("shown.right"), 0);
  });

  it("takes a drag: the painted size follows it and an expected resize is accepted once", () => {
    const { host } = fakeHost({ open: { "shown.left": true }, sizes: { "shown.left": 300 } });
    const tween = tweenOf({ host, table: TABLE, stageMin: 240 }, ["shown.left"]);
    tween.beginDrag("shown.left", 300);
    tween.noteDrag("shown.left", 330);
    assert.equal(tween.paintOf("shown.left"), 330);
    tween.commitDrag("shown.left", 340);
    assert.equal(tween.paintOf("shown.left"), 340);
    tween.expectResize([340, 800]);
    assert.equal(tween.acceptsResize([340.4, 800]), true);
    assert.equal(tween.acceptsResize([340, 800]), false, "an expected resize is spent when it is heard");
  });
});

describe("usePaneOpen over a PaneHost", () => {
  const read = (host: PaneHost, side: "left" | "right"): boolean => {
    const found: boolean[] = [];
    function Probe() {
      found.push(usePaneOpen(host, "shown", side));
      return null;
    }
    renderToStaticMarkup(<Probe />);
    return found[0] ?? false;
  };

  it("reads a recorded pane as recorded, and a pane never recorded as open", () => {
    const { host } = fakeHost({ open: { "shown.left": false } });
    assert.equal(read(host, "left"), false);
    assert.equal(read(host, "right"), true);
  });
});
