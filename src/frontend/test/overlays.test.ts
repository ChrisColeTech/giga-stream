import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the one open flow", () => {
  it("opening a work window replaces the open one", () => {
    state().openOverlay("settings");
    assert.equal(state().overlay, "settings");
    state().openOverlay("collections");
    assert.equal(state().overlay, "collections");
    assert.equal(state().overlayAnchor, null);
    state().closeOverlay();
    assert.equal(state().overlay, null);
    assert.equal(state().overlayAnchor, null);
  });

  it("opens Account as a work window without a popup overlay handoff", () => {
    state().openOverlay("account");
    assert.equal(state().overlay, "account");
    assert.equal(state().overlayAnchor, null);
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
