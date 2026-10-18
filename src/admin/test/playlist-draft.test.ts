import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changedFields, isEmptyPatch } from "@/lib/playlist-body";
import {
  EMPTY_NEW_PLAYLIST,
  createReason,
  draftOf,
  firstRefusal,
  newAddressOf,
  replaceReason,
  samePlaylistDraft,
  startReplace,
} from "@/lib/playlist-draft";
import { discardForm, isDirty, setFields, startForm } from "@/lib/record-form";
import type { AdminPlaylist } from "@/services/schemas/playlist-schema";

const SAVED: AdminPlaylist = {
  id: 1,
  name: "Main",
  host: "iptv.example.test",
  masked: "iptv.example.test/…",
  enabled: true,
  channels: 2,
};

describe("the Replace state machine", () => {
  it("starts locked and empty: the address is never filled from a record", () => {
    const draft = draftOf(SAVED);
    assert.deepEqual([draft.replacing, draft.address, replaceReason(draft)], [false, "", undefined]);
  });

  it("unlocks empty, disables itself with its reason, and an unlocked empty field is no change", () => {
    const base = startForm(draftOf(SAVED));
    const unlocked = setFields(base, startReplace(base.draft));
    assert.equal(unlocked.draft.replacing, true);
    assert.equal(replaceReason(unlocked.draft), "Type the new value, then Save.");
    assert.equal(isDirty(unlocked, samePlaylistDraft), false);
    assert.equal(newAddressOf(unlocked.draft), null);
    assert.ok(isEmptyPatch(changedFields(SAVED, unlocked.draft)));
  });

  it("is a change once a value is typed, and Discard locks it again with the value gone", () => {
    const base = startForm(draftOf(SAVED));
    const typed = setFields(base, { ...startReplace(base.draft), address: " https://new.example.test/x " });
    assert.equal(isDirty(typed, samePlaylistDraft), true);
    assert.deepEqual(changedFields(SAVED, typed.draft), { address: "https://new.example.test/x" });
    const discarded = discardForm(typed);
    assert.deepEqual([discarded.draft.replacing, discarded.draft.address], [false, ""]);
  });

  it("sends only what changed; an emptied name means the host, as on create", () => {
    assert.deepEqual(changedFields(SAVED, { ...draftOf(SAVED), name: " Other " }), { name: "Other" });
    assert.deepEqual(changedFields(SAVED, { ...draftOf(SAVED), name: "" }), { name: "iptv.example.test" });
    assert.deepEqual(changedFields({ ...SAVED, name: SAVED.host }, { ...draftOf(SAVED), name: "" }), {});
    assert.deepEqual(changedFields(SAVED, { ...draftOf(SAVED), enabled: false }), { enabled: false });
  });
});

describe("the playlist checks", () => {
  it("disable Create with `Address is required.` only; the Name never gates it", () => {
    assert.equal(createReason(EMPTY_NEW_PLAYLIST, undefined), "Address is required.");
    assert.equal(createReason({ name: "", address: "https://x.test/a" }, undefined), undefined);
    assert.equal(createReason({ name: "", address: "https://x.test/a" }, "Saving."), "Saving.");
  });

  it("refuse an address that is not https under Address, and a name over 120 under Name", () => {
    assert.deepEqual(firstRefusal("", "http://x.test/a"), {
      field: "address",
      sentence: "Address must be an https address.",
    });
    assert.equal(firstRefusal("", "https://x.test/a"), null);
    assert.equal(firstRefusal("n".repeat(121), "https://x.test/a")?.field, "name");
    assert.equal(firstRefusal("Main", null), null);
  });
});
