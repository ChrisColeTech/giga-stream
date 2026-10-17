import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SURFACES, SURFACE_ORDER, limitsOf, limitsOfKey, paneKey } from "@/constants/surfaces";
import { resolveReduceMotion } from "@giga/ui/hooks/useReduceMotion";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("pane state", () => {
  it("starts every pane a surface has open at its preferred size, and records none it lacks", () => {
    for (const surface of SURFACE_ORDER) {
      for (const side of ["left", "right", "bottom"] as const) {
        const limits = limitsOf(surface, side);
        const key = paneKey(surface, side);
        if (limits === null) {
          assert.equal(state().open[key], undefined, `${key} must not exist`);
        } else {
          assert.equal(state().open[key], true);
          assert.equal(state().sizes[key], limits.preferred);
        }
      }
    }
  });

  it("toggles only the active surface's pane and bumps the open version once", () => {
    state().setSurface("live");
    state().togglePane("left");
    assert.equal(state().open["live.left"], false);
    assert.equal(state().open["library.left"], true);
    assert.equal(state().openVersion, 1);
    state().togglePane("left");
    assert.equal(state().open["live.left"], true);
    assert.equal(state().openVersion, 2);
  });

  it("ignores a toggle for a pane the surface does not have", () => {
    state().setSurface("live");
    state().togglePane("bottom");
    assert.equal(state().openVersion, 0);
    assert.equal(state().open["live.bottom"], undefined);
  });

  it("commits a dragged size without counting it as an open change", () => {
    state().commitSizes({ "player.right": 400 });
    assert.equal(state().sizes["player.right"], 400);
    assert.equal(state().openVersion, 0);
  });
});

describe("the pane table", () => {
  it("keeps every preferred size inside its own min and max, and gives the centre a floor", () => {
    for (const surface of SURFACE_ORDER) {
      assert.ok(SURFACES[surface].centerMin >= 480);
      for (const side of ["left", "right", "bottom"] as const) {
        const limits = limitsOf(surface, side);
        if (limits === null) continue;
        assert.ok(limits.min <= limits.preferred && limits.preferred <= limits.max, `${surface}.${side}`);
        assert.deepEqual(limitsOfKey(paneKey(surface, side)), limits);
      }
    }
  });
});

describe("reduced motion", () => {
  it("On always skips, Off never skips", () => {
    assert.equal(resolveReduceMotion("on"), true);
    assert.equal(resolveReduceMotion("off"), false);
  });
});
