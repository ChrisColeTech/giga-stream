import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  previewIndexReason,
  previewWorkspaceReason,
  rebuildReason,
  revertReason,
} from "@/lib/channel-guard";
import { live, stream } from "./support/channels-kit";

const OPEN = { saving: false, unreachable: false };

describe("the Channels tab's disabled reasons", () => {
  it("gate the index's Preview → on exactly one ticked row, live or stream", () => {
    assert.deepEqual([0, 2, 1].map(previewIndexReason), ["Tick a row first", "Tick only one row", undefined]);
  });

  it("gate a workspace's Preview → on a saved draft", () => {
    assert.deepEqual([previewWorkspaceReason(true), previewWorkspaceReason(false)], ["Save the channel first", undefined]);
  });

  it("give Rebuild its reasons in order: unsaved changes, disabled, then the write state", () => {
    assert.equal(rebuildReason(live("a"), true, OPEN), "Save the channel first");
    assert.equal(rebuildReason(live("a", { enabled: false }), false, OPEN), "Enable the channel to rebuild it.");
    assert.equal(rebuildReason(live("a"), false, { saving: true, unreachable: false }), "Saving.");
    assert.equal(rebuildReason(live("a"), false, OPEN), undefined);
    assert.equal(rebuildReason(stream("s"), false, OPEN), "A stream channel has nothing to rebuild.");
  });

  it("allow Revert to playlist only on a synced row with edits", () => {
    assert.equal(revertReason(stream("s"), OPEN), "This channel was made by hand; there is nothing to revert.");
    assert.equal(revertReason(stream("s", { source: "lists.example" }), OPEN), "Nothing was edited.");
    assert.equal(revertReason(stream("s", { source: "lists.example", editedFields: [] }), OPEN), "Nothing was edited.");
    assert.equal(revertReason(stream("s", { source: "lists.example", editedFields: ["name"] }), OPEN), undefined);
  });
});
