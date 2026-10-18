import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { FORWARD_ICONS, FORWARD_TOOLTIPS, type ForwardDestination } from "@/constants/toolbar-icons";
import { indexVerbs } from "@/lib/index-verbs";
import { forwardVerbs } from "@/lib/workspace-verbs";
import { TAB_ORDER } from "@/constants/tabs";

const NOTHING = (): void => undefined;
const DESTINATIONS = Object.keys(FORWARD_ICONS) as ForwardDestination[];

describe("the forward icons", () => {
  it("give every destination its own icon, shared with no other destination and no bulk verb", () => {
    const icons = DESTINATIONS.map((destination) => FORWARD_ICONS[destination]);
    assert.equal(DESTINATIONS.length, 7);
    assert.equal(new Set(icons).size, icons.length, "no two destinations share an icon");
    for (const bulk of Object.values(BULK_ICONS)) assert.ok(!icons.includes(bulk));
  });

  it("name the verb and where it goes in a distinct tooltip", () => {
    const tips = DESTINATIONS.map((destination) => FORWARD_TOOLTIPS[destination]);
    assert.equal(new Set(tips).size, tips.length);
    assert.equal(FORWARD_TOOLTIPS.Preview, "Preview channel");
    assert.equal(FORWARD_TOOLTIPS.Titles, "Go to Titles");
  });

  it("reach every toolbar verb with an icon, an aria-label source and a tooltip", () => {
    const verbs = [
      ...TAB_ORDER.flatMap((tab) => indexVerbs(INDEX_FRAMES[tab].forward, NOTHING)),
      ...DESTINATIONS.flatMap((label) => forwardVerbs({ label, onPress: NOTHING })),
    ];
    assert.ok(verbs.length >= 7);
    for (const verb of verbs) {
      assert.equal(typeof verb.icon, "object", verb.label);
      assert.ok(verb.label.length > 0 && Object.values(FORWARD_TOOLTIPS).includes(verb.label), verb.label);
    }
  });

  it("keep every bulk verb on its own icon", () => {
    const icons = Object.values(BULK_ICONS);
    assert.equal(new Set(icons).size, icons.length);
  });
});
