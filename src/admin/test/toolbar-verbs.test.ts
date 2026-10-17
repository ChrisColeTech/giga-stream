import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INDEX_FRAMES } from "@/constants/index-frames";
import { NOTHING_CHANGED, TICK_FIRST, TICK_JOB_FIRST } from "@/constants/record-copy";
import { TAB_ORDER } from "@/constants/tabs";
import { indexVerbs } from "@/lib/index-verbs";
import { workspaceVerbs, type WorkspaceVerbs } from "@/lib/workspace-verbs";
import type { Tab } from "@/types/shell";

const NOTHING = (): void => undefined;
const verbs = (extra: Partial<WorkspaceVerbs> = {}): WorkspaceVerbs => ({
  dirty: false,
  discard: { label: "Discard changes", onPress: NOTHING },
  save: { label: "Save", onPress: NOTHING },
  forward: { label: "Titles →", onPress: NOTHING },
  ...extra,
});

describe("a workspace's strip", () => {
  it("is Discard changes (ghost), Save (edged) and the forward verb (filled), in that order", () => {
    const strip = workspaceVerbs(verbs());
    assert.deepEqual(strip.map((verb) => [verb.label, verb.tone]), [
      ["Discard changes", "ghost"],
      ["Save", "edged"],
      ["Titles →", "filled"],
    ]);
  });

  it("disables Discard and Save with `Nothing has changed.` while the draft equals its baseline", () => {
    const [discard, save, forward] = workspaceVerbs(verbs());
    assert.equal(NOTHING_CHANGED, "Nothing has changed.");
    assert.equal(discard?.reason, NOTHING_CHANGED);
    assert.equal(save?.reason, NOTHING_CHANGED);
    assert.equal(forward?.reason, undefined, "the forward verb does not wait on a change");
  });

  it("enables both once the draft has changed", () => {
    const [discard, save] = workspaceVerbs(verbs({ dirty: true }));
    assert.equal(discard?.reason, undefined);
    assert.equal(save?.reason, undefined);
  });

  it("lets the page give a reason of its own once something has changed, and never over `Nothing has changed.`", () => {
    const own = { label: "Save", onPress: NOTHING, reason: "Number must be a whole number from 1 to 9999." };
    assert.equal(workspaceVerbs(verbs({ dirty: true, save: own }))[1]?.reason, own.reason);
    assert.equal(workspaceVerbs(verbs({ dirty: false, save: own }))[1]?.reason, NOTHING_CHANGED);
  });

  it("carries the forward verb's own reason (`Save the channel first` after an edit)", () => {
    const forward = { label: "Preview →", onPress: NOTHING, reason: "Save the channel first" };
    assert.equal(workspaceVerbs(verbs({ dirty: true, forward }))[2]?.reason, "Save the channel first");
  });

  it("leaves the forward verb out on a page that has none", () => {
    const strip = workspaceVerbs({ ...verbs(), forward: undefined });
    assert.deepEqual(strip.map((verb) => verb.id), ["discard", "save"]);
  });

  it("calls each verb's own handler", () => {
    const calls: string[] = [];
    const strip = workspaceVerbs(
      verbs({
        dirty: true,
        discard: { label: "Discard changes", onPress: () => calls.push("discard") },
        save: { label: "Save", onPress: () => calls.push("save") },
        forward: { label: "Go", onPress: () => calls.push("forward") },
      }),
    );
    for (const verb of strip) verb.onPress();
    assert.deepEqual(calls, ["discard", "save", "forward"]);
  });
});

describe("an index's strip", () => {
  it("has the forward verb only, filled", () => {
    const strip = indexVerbs(INDEX_FRAMES.providers.forward, NOTHING);
    assert.deepEqual(strip.map((verb) => [verb.label, verb.tone, verb.reason]), [["Titles →", "filled", undefined]]);
  });

  it("switches to the named tab when its verb is pressed", () => {
    const asked: Tab[] = [];
    const [verb] = indexVerbs(INDEX_FRAMES.titles.forward, (tab) => asked.push(tab));
    verb?.onPress();
    assert.deepEqual(asked, ["jobs"]);
  });

  it("is disabled with its reason when the verb acts on ticked rows and none can be ticked yet", () => {
    assert.equal(indexVerbs(INDEX_FRAMES.channels.forward, NOTHING)[0]?.reason, TICK_FIRST);
    assert.equal(indexVerbs(INDEX_FRAMES.jobs.forward, NOTHING)[0]?.reason, TICK_JOB_FIRST);
    assert.equal(TICK_FIRST, "Tick a row first");
    assert.equal(TICK_JOB_FIRST, "Tick a job first");
  });

  it("is empty for Accounts, the last tab", () => {
    assert.deepEqual(indexVerbs(INDEX_FRAMES.accounts.forward, NOTHING), []);
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
