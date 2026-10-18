import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NOTHING_CHANGED, TICK_FIRST } from "@/constants/record-copy";
import { TAB_ORDER } from "@/constants/tabs";
import { indexVerbs } from "@/lib/index-verbs";
import { changeReason, forwardVerbs } from "@/lib/workspace-verbs";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;

describe("a workspace's toolbar", () => {
  it("is the forward arrow alone: an icon verb whose label is the tooltip, with no arrow in the words", () => {
    const [verb, ...rest] = forwardVerbs({ label: "Titles", onPress: NOTHING });
    assert.equal(rest.length, 0);
    assert.equal(verb?.label, "Titles");
    assert.equal(typeof verb?.icon, "object", "a lucide icon component");
    assert.ok(!(verb?.label ?? "").includes("→"));
  });

  it("is empty on a page that has no forward verb", () => {
    assert.deepEqual(forwardVerbs(undefined), []);
  });

  it("carries the forward verb's own reason and calls its handler", () => {
    const calls: string[] = [];
    const [verb] = forwardVerbs({ label: "Preview", onPress: () => calls.push("go"), reason: "Save the channel first" });
    assert.equal(verb?.reason, "Save the channel first");
    verb?.onPress();
    assert.deepEqual(calls, ["go"]);
  });
});

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

describe("an index's toolbar", () => {
  it("has the forward arrow only", () => {
    const strip = indexVerbs(INDEX_FRAMES.providers.forward, NOTHING);
    assert.deepEqual(strip.map((verb) => [verb.label, verb.reason]), [["Titles", undefined]]);
  });

  it("switches to the named tab when its verb is pressed", () => {
    const asked: Tab[] = [];
    const [verb] = indexVerbs(INDEX_FRAMES.titles.forward, (tab) => asked.push(tab));
    verb?.onPress();
    assert.deepEqual(asked, ["jobs"]);
  });

  it("is disabled with its reason when the verb acts on a ticked row and none can be ticked yet", () => {
    assert.equal(indexVerbs(INDEX_FRAMES.channels.forward, NOTHING)[0]?.reason, TICK_FIRST);
    assert.equal(TICK_FIRST, "Tick a row first");
  });

  it("is empty for Accounts and for Jobs, whose Run job is the table strip's", () => {
    assert.deepEqual(indexVerbs(INDEX_FRAMES.accounts.forward, NOTHING), []);
    assert.deepEqual(indexVerbs(INDEX_FRAMES.jobs.forward, NOTHING), []);
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
