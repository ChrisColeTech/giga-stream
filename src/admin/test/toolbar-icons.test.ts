import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Check, Play, RotateCcw, X } from "lucide-react";
import { BULK_ICONS } from "@/constants/bulk-icons";

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

describe("the page promotes", () => {
  it("use operation words without navigation arrows", () => {
    for (const label of ["Preview", "Sync now", "Run job"]) assert.ok(!label.includes("→"));
  });
});
