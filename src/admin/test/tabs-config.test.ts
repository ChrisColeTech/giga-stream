import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { limitsOf, paneKey } from "@giga/ui/panes/pane-limits";
import { CENTER_MIN, DEFAULT_TAB, PANE_TABLE, RAIL_LIMITS, TABS, TAB_ORDER, railKey } from "@/constants/tabs";
import { SHELL_MIN_SIZE } from "@/constants/window";

describe("the tab pill", () => {
  it("has the six tabs in the order of the plan, and Channels first", () => {
    assert.deepEqual(TAB_ORDER, ["channels", "providers", "titles", "playlists", "jobs", "accounts"]);
    assert.deepEqual(
      TABS.map((tab) => tab.label),
      ["Channels", "Providers", "Titles", "Playlists", "Jobs", "Accounts"],
    );
    assert.equal(DEFAULT_TAB, "channels");
  });

  it("titles each tab `<Tab> (Ctrl+N)` with N its place in the pill", () => {
    TABS.forEach((tab, index) => assert.equal(tab.hint, `${tab.label} (Ctrl+${index + 1})`));
  });

  it("has one id per tab and no role gate: every tab is for every signed-in admin", () => {
    assert.equal(new Set(TAB_ORDER).size, 6);
    for (const tab of TABS) assert.deepEqual(Object.keys(tab).sort(), ["hint", "id", "label"]);
  });
});

describe("the pane limits table", () => {
  it("gives every tab a left pane of 190 to 380, 240 by default, and no right or bottom pane", () => {
    assert.deepEqual(RAIL_LIMITS, { min: 190, max: 380, preferred: 240 });
    for (const tab of TAB_ORDER) {
      assert.deepEqual(limitsOf(PANE_TABLE, tab, "left"), RAIL_LIMITS);
      assert.equal(limitsOf(PANE_TABLE, tab, "right"), null);
      assert.equal(limitsOf(PANE_TABLE, tab, "bottom"), null);
      assert.equal(PANE_TABLE[tab]?.centerMin, CENTER_MIN);
    }
  });

  it("knows no tab but the six", () => {
    assert.deepEqual(Object.keys(PANE_TABLE).sort(), [...TAB_ORDER].sort());
    assert.equal(limitsOf(PANE_TABLE, "settings", "left"), null);
  });

  it("keys a tab's rail `<tab>.left`", () => {
    assert.equal(railKey("titles"), "titles.left");
    assert.equal(railKey("titles"), paneKey("titles", "left"));
  });
});

describe("the shell's floor", () => {
  it("is 900 x 640", () => {
    assert.deepEqual(SHELL_MIN_SIZE, { width: 900, height: 640 });
    assert.ok(CENTER_MIN + RAIL_LIMITS.preferred < SHELL_MIN_SIZE.width, "the rail fits beside the centre at the floor");
  });
});
