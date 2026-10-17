import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromWireShell, toWireShell } from "@/services/shell-state";
import { decodeState } from "@/services/state";

describe("state decoding", () => {
  it("keeps readable siblings when one snapshot part is malformed", () => {
    const state = decodeState({
      version: "0.2.0",
      host: { runtime: "electron" },
      settings: { theme: "unknown" },
      lastChannelId: "fx-news",
    });
    assert.equal(state.version, "0.2.0");
    assert.deepEqual(state.host, { runtime: "electron" });
    assert.equal(state.lastChannelId, "fx-news");
    assert.equal(state.settings, undefined);
    assert.ok(state.unreadable.includes("settings"));
  });
});

describe("shell-state wire translation", () => {
  it("maps semantic server pane ids to positional frontend keys and back", () => {
    const wire = {
      activeSurface: "player" as const,
      paneVisibility: { "player.browser": false, "player.inspector": true },
      paneSizes: { "player.browser": [240], "player.inspector": [300] },
    };
    const layout = fromWireShell(wire);
    assert.equal(layout.open["player.left"], false);
    assert.equal(layout.open["player.right"], true);
    assert.equal(layout.sizes["player.left"], 240);
    assert.deepEqual(toWireShell(layout), wire);
  });
});
