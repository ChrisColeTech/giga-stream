import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { isPopupOverlay } from "@/constants/popups";
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
