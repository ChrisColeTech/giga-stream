import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectionsSubmenu } from "@/lib/collection-menu";
import { stageMenuItems, type StageMenuInput } from "@/lib/player-stage-menu";

function input(calls: string[], change: Partial<StageMenuInput> = {}): StageMenuInput {
  return {
    fullscreen: false,
    favorite: false,
    collections: collectionsSubmenu([], () => false, () => undefined),
    onRetry: () => calls.push("retry"),
    onFullscreen: () => calls.push("fullscreen"),
    onReveal: () => calls.push("reveal"),
    onFavorite: () => calls.push("favorite"),
    onClose: () => calls.push("close"),
    ...change,
  };
}

const labels = (items: ReturnType<typeof stageMenuItems>) =>
  items.map((entry) => (entry.kind === "action" || entry.kind === "submenu" ? entry.label : entry.kind));

describe("the stage's context menu", () => {
  it("holds the playback verbs, then the item's marks, then Close", () => {
    assert.deepEqual(labels(stageMenuItems(input([]))), [
      "Retry",
      "Full screen",
      "Reveal in Library",
      "separator",
      "Favorite",
      "Collections",
      "separator",
      "Close",
    ]);
  });

  it("names the state it would change, and offers Remove from History only with a watch entry", () => {
    const items = stageMenuItems(input([], { fullscreen: true, favorite: true, onRemoveHistory: () => undefined }));
    assert.deepEqual(labels(items).slice(0, 7), [
      "Retry",
      "Exit full screen",
      "Reveal in Library",
      "separator",
      "Unfavorite",
      "Collections",
      "Remove from History",
    ]);
  });

  it("every action acts when chosen", () => {
    const calls: string[] = [];
    for (const entry of stageMenuItems(input(calls))) if (entry.kind === "action") entry.onSelect();
    assert.deepEqual(calls, ["retry", "fullscreen", "reveal", "favorite", "close"]);
  });
});
