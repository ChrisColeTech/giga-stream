import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";

describe("every verb has a tooltip at rest", () => {
  it("each bulk verb that has an icon has a tip naming what it does to the ticked rows", () => {
    for (const key of Object.keys(BULK_ICONS)) assert.ok(key in BULK_TIPS, key);
    for (const [verb, tip] of Object.entries(BULK_TIPS)) assert.ok(tip.length > 0 && !tip.endsWith("."), verb);
  });
});
