import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TITLE_INFO_SPEC } from "@/components/overlays/TitleInfoWindow";
import { OPEN_SHARE } from "@/constants/child-window";

describe("Title information's window", () => {
  it("opens 880x620 under the versioned @2 memory key (`50` section 2.7)", () => {
    assert.equal(TITLE_INFO_SPEC.key, "title-info@2", "an old remembered box cannot restore the small size");
    assert.equal(TITLE_INFO_SPEC.width, 880);
    assert.equal(TITLE_INFO_SPEC.body, 620);
  });

  it("stays inside the family's least and the main window's 80% share on first open", () => {
    assert.ok(TITLE_INFO_SPEC.width >= TITLE_INFO_SPEC.minWidth);
    assert.ok(TITLE_INFO_SPEC.body >= TITLE_INFO_SPEC.minBody);
    const main = 1600 * OPEN_SHARE;
    assert.ok(TITLE_INFO_SPEC.width <= main, `880 fits the 80% share of a 1600 room (${main})`);
  });
});
