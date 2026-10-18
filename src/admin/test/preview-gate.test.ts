import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { OverlayHost } from "@/components/overlays/OverlayHost";
import { previewIndexReason, previewWorkspaceReason } from "@/lib/channel-guard";
import { useAppStore } from "@/store/app-store";
import { live } from "./support/channels-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const open = (id: string): void => {
  state().channelsOpenPreview(id);
  state().openOverlay("preview");
};

beforeEach(() => {
  resetStore();
  signInForTest();
});

/* The window reads the viewport and listens for its resize; the server render has no DOM, so a stub stands in. */
before(() => {
  const none = (): void => undefined;
  Reflect.set(globalThis, "window", { innerWidth: 1600, innerHeight: 1000, addEventListener: none, removeEventListener: none });
});
after(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("the Preview's gate and its window", () => {
  it("takes one ticked row on the index and a saved draft in a workspace; a New form never gates it", () => {
    assert.deepEqual([previewIndexReason(0), previewIndexReason(2), previewIndexReason(1)], ["Tick a row first", "Tick only one row", undefined]);
    assert.deepEqual([previewWorkspaceReason(true), previewWorkspaceReason(false)], ["Save the channel first", undefined]);
  });

  it("is the one open flow: opening it replaces Settings, and Settings replaces it", () => {
    state().openOverlay("settings");
    open("a");
    assert.equal(state().overlay, "preview");
    state().openOverlay("settings");
    assert.equal(state().overlay, "settings");
  });

  it("draws a modal Preview window: the stage's muted video with native controls, the status line, no other control", () => {
    state().channelsLoaded([live("a")], 1);
    open("a");
    const html = renderLive(createElement(OverlayHost));
    assert.ok(html.includes('aria-label="Preview window"') && html.includes('aria-modal="true"'));
    assert.ok(/<video[^>]*controls=""[^>]*muted=""/.test(html) && html.includes("bg-stage"));
    assert.ok(html.includes('role="status"') && html.includes(">loading</span>"), "the first read is running");
    assert.ok(!html.includes("<p>") && !html.includes("<p "), "the window's status is one state word, never a paragraph");
    assert.ok(html.includes("animate-skel-shimmer"), "the stage waits under its skeleton");
    assert.ok(html.includes('aria-label="Close Preview"'));
    assert.ok(!html.includes("<iframe") && !html.includes("/test/") && !html.includes("<select"));
  });

  it("raises the serial at every open, so each open reads afresh", () => {
    open("a");
    const first = state().channels.preview?.serial ?? 0;
    state().closeOverlay();
    open("a");
    assert.ok((state().channels.preview?.serial ?? 0) > first);
  });
});
