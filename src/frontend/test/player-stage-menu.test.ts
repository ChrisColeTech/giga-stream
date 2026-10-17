import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stageMenuItems } from "@/lib/player-stage-menu";
import type { MenuItem } from "@/types/menu";

describe("the stage toolbar's menu", () => {
  it("holds Reveal in Library and Close, with a separator between them", () => {
    const items = stageMenuItems({ onReveal: () => undefined, onClose: () => undefined });
    assert.deepEqual(
      items.map((entry) => (entry.kind === "action" ? entry.label : entry.kind)),
      ["Reveal in Library", "separator", "Close"],
    );
  });

  it("both rows act when chosen and neither is off", () => {
    const calls: string[] = [];
    const items = stageMenuItems({ onReveal: () => calls.push("reveal"), onClose: () => calls.push("close") });
    for (const entry of items) {
      if (entry.kind === "action") {
        assert.equal(entry.disabled, undefined);
        entry.onSelect();
      }
    }
    assert.deepEqual(calls, ["reveal", "close"]);
  });

  it("returns menu rows only, never a submenu", () => {
    const items: MenuItem[] = stageMenuItems({ onReveal: () => undefined, onClose: () => undefined });
    assert.equal(items.some((entry) => entry.kind === "submenu"), false);
  });
});
