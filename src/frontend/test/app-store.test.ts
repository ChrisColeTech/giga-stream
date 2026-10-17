import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SURFACES, SURFACE_ORDER, limitsOf, limitsOfKey, paneKey } from "@/constants/surfaces";
import { resolveReduceMotion } from "@/hooks/useReduceMotion";
import { DEFAULT_SETTINGS } from "@/constants/settings-defaults";
import { useAppStore } from "@/store/app-store";
import { decodeState } from "@/services/state";

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

describe("store slices and hydration", () => {
  it("restores saved shell and settings once, including after fallback reveal", () => {
    state().revealShell();
    assert.equal(state().shellWriteEnabled, false);
    assert.equal(state().settingsWriteEnabled, false);
    state().applySnapshot({
      shell: {
        activeSurface: "player",
        paneVisibility: { "player.browser": false },
        paneSizes: { "player.browser": [300] },
      },
      settings: { ...DEFAULT_SETTINGS, libraryView: "rows", theme: "light" },
      unreadable: [],
    });
    assert.equal(state().surface, "player");
    assert.equal(state().open["player.left"], false);
    assert.equal(state().sizes["player.left"], 300);
    assert.equal(state().library.libraryView, "rows");
    assert.equal(state().theme, "light");
    assert.equal(state().hydrationVersion, 1);
    assert.equal(state().shellWriteEnabled, true);
    assert.equal(state().settingsWriteEnabled, true);

    state().setSurface("live");
    state().setTheme("dark");
    state().applySnapshot({
      shell: { activeSurface: "library", paneVisibility: {}, paneSizes: {} },
      settings: { ...DEFAULT_SETTINGS, theme: "system" },
      unreadable: [],
    });
    assert.equal(state().surface, "live");
    assert.equal(state().theme, "dark");
    assert.equal(state().hydrationVersion, 1);
  });

  it("does not enable persistence for absent or unreadable snapshot parts", () => {
    const malformed = decodeState({
      shell: { activeSurface: "future", paneVisibility: {}, paneSizes: {} },
      settings: { theme: "future" },
    });
    state().applySnapshot(malformed);
    assert.ok(malformed.unreadable.includes("shell"));
    assert.ok(malformed.unreadable.includes("settings"));
    assert.equal(state().hydrationApplied, true);
    assert.equal(state().shellWriteEnabled, false);
    assert.equal(state().settingsWriteEnabled, false);
    state().setSurface("player");
    state().setTheme("light");
    assert.equal(state().shellWriteEnabled, false);
    assert.equal(state().settingsWriteEnabled, false);
  });

  it("provides live, playback and library state for later surface waves", () => {
    state().setChannels({ items: [], categories: [], revision: 4 });
    state().setChannelQuery("news");
    state().setLiveStage("loading");
    state().setLibraryCounts({ all: 8, history: 2, favorites: 1, collections: {} });
    state().setPlayerTabs([]);
    assert.equal(state().channels?.revision, 4);
    assert.equal(state().channelQuery, "news");
    assert.equal(state().liveStage, "loading");
    assert.equal(state().libraryCounts.all, 8);
    assert.deepEqual(state().playerTabs, []);
  });
});
