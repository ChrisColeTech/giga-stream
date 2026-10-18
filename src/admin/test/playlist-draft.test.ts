import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changedFields, isEmptyPatch, urlBody } from "@/lib/playlist-body";
import {
  EMPTY_NEW_PLAYLIST,
  createReason,
  draftOf,
  firstRefusal,
  newAddressOf,
  replaceReason,
  samePlaylistDraft,
  sameNewPlaylist,
  startReplace,
} from "@/lib/playlist-draft";
import { discardForm, isDirty, setFields, startForm } from "@/lib/record-form";
import { filePlaylist, playlist } from "./support/run-kit";

const SAVED = playlist(1, { name: "Main" });
const US = filePlaylist(2);
const m3u = new File(["#EXTM3U\n"], "us.m3u", { type: "audio/x-mpegurl" });

describe("the Replace state machine", () => {
  it("starts locked and empty: the address is never filled from a record", () => {
    const draft = draftOf(SAVED);
    assert.deepEqual([draft.replacing, draft.address, replaceReason(draft, SAVED)], [false, "", undefined]);
  });

  it("unlocks empty, disables itself with its reason, and an unlocked empty field is no change", () => {
    const base = startForm(draftOf(SAVED));
    const unlocked = setFields(base, startReplace(base.draft));
    assert.equal(unlocked.draft.replacing, true);
    assert.equal(replaceReason(unlocked.draft, SAVED), "Type the new value, then Save.");
    assert.equal(isDirty(unlocked, samePlaylistDraft), false);
    assert.equal(newAddressOf(unlocked.draft), null);
    assert.ok(isEmptyPatch(changedFields(SAVED, unlocked.draft)));
  });

  it("is a change once a value is typed, sent as `url`, and Discard locks it again with the value gone", () => {
    const base = startForm(draftOf(SAVED));
    const typed = setFields(base, { ...startReplace(base.draft), address: " https://new.example.test/x " });
    assert.equal(isDirty(typed, samePlaylistDraft), true);
    assert.deepEqual(changedFields(SAVED, typed.draft), { url: "https://new.example.test/x" });
    const discarded = discardForm(typed);
    assert.deepEqual([discarded.draft.replacing, discarded.draft.address], [false, ""]);
  });

  it("is disabled for a file playlist: it has no web address, so the file is imported again", () => {
    assert.equal(replaceReason(draftOf(US), US), "A file playlist has no web address. Import the file again.");
  });

  it("sends only what changed; an emptied name is no change", () => {
    assert.deepEqual(changedFields(SAVED, { ...draftOf(SAVED), name: " Other " }), { name: "Other" });
    assert.deepEqual(changedFields(SAVED, { ...draftOf(SAVED), name: "" }), {});
    assert.deepEqual(changedFields(SAVED, { ...draftOf(SAVED), enabled: false }), { enabled: false });
  });
});

describe("the New playlist draft", () => {
  it("starts on File with nothing chosen and no Name", () => {
    assert.deepEqual(EMPTY_NEW_PLAYLIST, { source: "file", file: null, address: "" });
    assert.equal("name" in EMPTY_NEW_PLAYLIST, false);
  });

  it("holds the chosen file, and a draft with another file or source is another value", () => {
    const chosen = { ...EMPTY_NEW_PLAYLIST, file: m3u };
    assert.equal(sameNewPlaylist(chosen, { ...EMPTY_NEW_PLAYLIST, file: m3u }), true);
    assert.equal(sameNewPlaylist(chosen, EMPTY_NEW_PLAYLIST), false);
    assert.equal(sameNewPlaylist(EMPTY_NEW_PLAYLIST, { ...EMPTY_NEW_PLAYLIST, source: "url" }), false);
  });

  it("disables Import with the chosen source's missing value first, then busy", () => {
    assert.equal(createReason(EMPTY_NEW_PLAYLIST, undefined), "Choose a file first.");
    assert.equal(createReason({ ...EMPTY_NEW_PLAYLIST, file: m3u }, undefined), undefined);
    assert.equal(createReason({ ...EMPTY_NEW_PLAYLIST, file: m3u }, "Importing."), "Importing.");
    const web = { ...EMPTY_NEW_PLAYLIST, source: "url" } as const;
    assert.equal(createReason(web, undefined), "Address is required.");
    assert.equal(createReason({ ...web, address: "https://x.test/a" }, "The admin backend cannot be reached."), "The admin backend cannot be reached.");
    assert.equal(createReason({ ...web, file: m3u }, undefined), "Address is required.", "a file kept from the other source is not an address");
  });

  it("sends the trimmed address alone as the web-address import body", () => {
    assert.deepEqual(urlBody({ ...EMPTY_NEW_PLAYLIST, source: "url", address: "  https://x.test/a.m3u " }), {
      url: "https://x.test/a.m3u",
    });
  });
});

describe("the playlist checks", () => {
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
