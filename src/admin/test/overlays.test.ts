import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { POPUP_CLASSES, POPUP_EDGE, isPopupOverlay } from "@/constants/popups";
import { clampToWindow, hangY } from "@/lib/popup-place";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the one open flow", () => {
  it("opening a flow replaces the open one and carries its anchor", () => {
    state().openOverlay("settings");
    assert.equal(state().overlay, "settings");
    state().openOverlay("collections", { x: 40, y: 60 });
    assert.equal(state().overlay, "collections");
    assert.deepEqual(state().overlayAnchor, { x: 40, y: 60 });
    state().closeOverlay();
    assert.equal(state().overlay, null);
    assert.equal(state().overlayAnchor, null);
  });

  it("tells a popup from a work frame; Title information is a work frame", () => {
    assert.equal(isPopupOverlay("title-info"), false);
    assert.equal(isPopupOverlay("collections"), false);
    assert.equal(isPopupOverlay("settings"), false);
    assert.equal(isPopupOverlay(null), false);
  });

  it("keeps one notice line and re-announces an identical sentence", () => {
    state().say("Saved.");
    const first = state().notice;
    state().say("Saved.", "warn");
    assert.equal(state().notice?.sentence, "Saved.");
    assert.equal(state().notice?.tone, "warn");
    assert.ok((state().notice?.serial ?? 0) > (first?.serial ?? 0));
  });
});

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
