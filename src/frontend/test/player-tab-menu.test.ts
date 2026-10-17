import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ONLY_TAB_REASON } from "@/lib/player-copy";
import { tabMenuItems } from "@/lib/player-menus";
import type { MenuItem } from "@/types/menu";

function actions(items: MenuItem[]): Extract<MenuItem, { kind: "action" }>[] {
  return items.filter((item): item is Extract<MenuItem, { kind: "action" }> => item.kind === "action");
}

describe("the tab context menu", () => {
  it("lists Close, Close others and Reveal in Library, in that order, with a separator before Reveal", () => {
    const items = tabMenuItems({ othersOpen: 2, onClose: () => undefined, onCloseOthers: () => undefined, onReveal: () => undefined });
    assert.deepEqual(
      items.map((item) => (item.kind === "action" ? item.label : item.kind)),
      ["Close", "Close others", "separator", "Reveal in Library"],
    );
  });

  it("Close others is off with its reason when no other tab is open", () => {
    const [, others] = actions(
      tabMenuItems({ othersOpen: 0, onClose: () => undefined, onCloseOthers: () => undefined, onReveal: () => undefined }),
    );
    assert.equal(others?.disabled, true);
    assert.equal(others?.disabledReason, ONLY_TAB_REASON);
  });

  it("Close and Reveal in Library call their callbacks when chosen", () => {
    const calls: string[] = [];
    const items = tabMenuItems({
      othersOpen: 1,
      onClose: () => calls.push("close"),
      onCloseOthers: () => calls.push("others"),
      onReveal: () => calls.push("reveal"),
    });
    const [close, , reveal] = actions(items);
    close?.onSelect();
    reveal?.onSelect();
    assert.deepEqual(calls, ["close", "reveal"]);
    assert.equal(reveal?.disabled, undefined);
  });
});
