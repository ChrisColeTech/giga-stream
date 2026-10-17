import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { RAIL_LIMITS, TAB_ORDER, railKey } from "@/constants/tabs";
import { PANE_ENGINE, PANE_HOST } from "@/store/pane-host";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the panes slice", () => {
  it("starts every tab's rail open at its preferred size, and records no other pane", () => {
    for (const tab of TAB_ORDER) {
      assert.equal(state().open[railKey(tab)], true);
      assert.equal(state().sizes[railKey(tab)], RAIL_LIMITS.preferred);
    }
    assert.equal(Object.keys(state().open).length, TAB_ORDER.length);
  });

  it("toggling raises openVersion once and flips only the active tab's rail", () => {
    state().setTab("titles");
    state().togglePane("left");
    assert.equal(state().open["titles.left"], false);
    assert.equal(state().open["channels.left"], true);
    assert.equal(state().openVersion, 1);
    state().togglePane("left");
    assert.equal(state().open["titles.left"], true);
    assert.equal(state().openVersion, 2);
  });

  it("a size commit does not raise openVersion and keeps the other sizes", () => {
    state().commitSizes({ "jobs.left": 300 });
    assert.equal(state().sizes["jobs.left"], 300);
    assert.equal(state().sizes["channels.left"], RAIL_LIMITS.preferred);
    assert.equal(state().openVersion, 0);
  });

  it("ignores a toggle for a side the admin has no pane on", () => {
    state().togglePane("right");
    state().togglePane("bottom");
    assert.equal(state().openVersion, 0);
    assert.equal(state().open["channels.right"], undefined);
  });

  it("a tab keeps its own rail state across a tab switch", () => {
    state().togglePane("left");
    state().setTab("providers");
    assert.equal(state().open["providers.left"], true);
    state().setTab("channels");
    assert.equal(state().open["channels.left"], false);
  });
});

describe("the pane engine's view of the store", () => {
  it("reads the admin's tab as the engine's surface, and the slice's own objects by reference", () => {
    state().setTab("playlists");
    const view = PANE_HOST.getState();
    assert.equal(view.surface, "playlists");
    assert.equal(view.open, state().open);
    assert.equal(view.sizes, state().sizes);
    assert.equal(view.openVersion, state().openVersion);
  });

  it("tells a subscriber both the new and the previous state", () => {
    const seen: Array<[number, number]> = [];
    const stop = PANE_HOST.subscribe((now, before) => seen.push([now.openVersion, before.openVersion]));
    state().togglePane("left");
    stop();
    state().togglePane("left");
    assert.deepEqual(seen, [[1, 0]]);
  });

  it("hands the engine the six-tab table", () => {
    assert.equal(Object.keys(PANE_ENGINE.table).length, 6);
    assert.equal(PANE_ENGINE.host, PANE_HOST);
  });
});
