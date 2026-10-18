import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Check, Eye, Play, RotateCcw, X } from "lucide-react";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { FORWARD_TOOLTIPS, PREVIEW_ICON, type ForwardDestination } from "@/constants/toolbar-icons";
import { TAB_ORDER } from "@/constants/tabs";
import { indexForward } from "@/lib/index-verbs";

const NOTHING = (): void => undefined;

describe("the bulk icons (01 section 9, Icon vocabulary)", () => {
  it("are the family's: Enable is LoRA's Keep, Disable its Reject, Run the interface's Play, Revert and Restore its RotateCcw", () => {
    assert.equal(BULK_ICONS.enable, Check);
    assert.equal(BULK_ICONS.disable, X);
    assert.equal(BULK_ICONS.run, Play);
    assert.equal(BULK_ICONS.revert, RotateCcw);
    assert.equal(BULK_ICONS.restore, RotateCcw);
  });

  it("leave Rebuild, Sync now and Delete as their word alone: no family icon, and a two-step never draws one", () => {
    assert.equal(BULK_ICONS.rebuild, undefined);
    assert.equal(BULK_ICONS.sync, undefined);
    assert.equal(BULK_ICONS.delete, undefined);
  });
});

describe("the forward verbs", () => {
  it("are words with no icon: every index's forward verb is its destination's word and a tooltip naming it", () => {
    const verbs = TAB_ORDER.map((tab) => indexForward(INDEX_FRAMES[tab].forward, NOTHING)).filter((verb) => verb !== undefined);
    assert.ok(verbs.length >= 3);
    for (const verb of verbs) {
      assert.ok(!("icon" in verb), verb.word);
      assert.equal(verb.tip, FORWARD_TOOLTIPS[verb.word as ForwardDestination]);
      assert.ok(!verb.word.includes("→"), "the arrow is drawn by the strip");
    }
  });

  it("name what they do in distinct tooltips", () => {
    const tips = Object.values(FORWARD_TOOLTIPS);
    assert.equal(new Set(tips).size, tips.length);
    assert.equal(FORWARD_TOOLTIPS.Preview, "Preview channel");
    assert.equal(FORWARD_TOOLTIPS.Titles, "Go to Titles");
  });

  it("keep one glyph, Preview's as a workspace row's trailing action: LoRA's View", () => {
    assert.equal(PREVIEW_ICON, Eye);
  });
});
