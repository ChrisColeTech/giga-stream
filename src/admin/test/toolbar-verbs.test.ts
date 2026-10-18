import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NOTHING_CHANGED, TICK_FIRST } from "@/constants/record-copy";
import { TAB_ORDER } from "@/constants/tabs";
import { indexForward } from "@/lib/index-verbs";
import { changeReason } from "@/lib/workspace-verbs";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;

describe("Save details and Discard changes", () => {
  it("wait with `Nothing has changed.` while the draft equals its baseline, whatever else is true", () => {
    assert.equal(NOTHING_CHANGED, "Nothing has changed.");
    assert.equal(changeReason(false), NOTHING_CHANGED);
    assert.equal(changeReason(false, "Saving."), NOTHING_CHANGED);
  });

  it("are enabled once the draft has changed, or give the page's own reason", () => {
    assert.equal(changeReason(true), undefined);
    const own = "Number must be a whole number from 1 to 9999.";
    assert.equal(changeReason(true, own), own);
  });
});

describe("an index's forward verb", () => {
  it("is the destination's word, the arrow and tooltip drawn by the page toolbar's button", () => {
    const verb = indexForward(INDEX_FRAMES.providers.forward, NOTHING);
    assert.deepEqual([verb?.label, verb?.reason], ["Titles", undefined]);
  });

  it("switches to the named tab when it is pressed", () => {
    const asked: Tab[] = [];
    indexForward(INDEX_FRAMES.titles.forward, (tab) => asked.push(tab))?.onPress();
    assert.deepEqual(asked, ["jobs"]);
  });

  it("is disabled with its reason when the verb acts on a ticked row and none can be ticked yet", () => {
    assert.equal(indexForward(INDEX_FRAMES.channels.forward, NOTHING)?.reason, TICK_FIRST);
    assert.equal(TICK_FIRST, "Tick a row first");
  });

  it("is absent for Accounts and for Jobs, whose Run job is a selection verb", () => {
    assert.equal(indexForward(INDEX_FRAMES.accounts.forward, NOTHING), undefined);
    assert.equal(indexForward(INDEX_FRAMES.jobs.forward, NOTHING), undefined);
  });

  it("names no table verb: a forward label is a tab or Preview", () => {
    for (const tab of TAB_ORDER) {
      const label = INDEX_FRAMES[tab].forward?.label;
      if (label !== undefined) assert.ok(["Preview", "Titles", "Jobs", "Channels"].includes(label), label);
    }
  });
});

describe("the six index frames", () => {
  it("cover every tab once, with the plan's icons and titles", () => {
    assert.deepEqual(Object.keys(INDEX_FRAMES).sort(), [...TAB_ORDER].sort());
    const titles = TAB_ORDER.map((tab) => [INDEX_FRAMES[tab].newTitle, INDEX_FRAMES[tab].listTitle]);
    assert.deepEqual(titles, [
      ["New channel", "Channels"],
      ["New provider", "Providers"],
      ["New title", "Titles"],
      ["New playlist", "Playlists"],
      ["New job", "Jobs"],
      ["New account", "Accounts"],
    ]);
  });

  it("send every forward verb on to a tab that exists", () => {
    for (const tab of TAB_ORDER) {
      const { to } = INDEX_FRAMES[tab].forward ?? {};
      if (to !== undefined) assert.ok(TAB_ORDER.includes(to), `${tab} -> ${to}`);
    }
  });
});
