import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBody, EMPTY_NEW_CHANNEL, isEmptyBody, patchBody, withKind } from "@/lib/channel-body";
import { channelField, checkChannel, createReason, newChannelRefusal } from "@/lib/channel-check";
import { liveDraft, streamDraft } from "@/lib/channel-draft";
import { live, stream } from "./support/channels-kit";

describe("a channel's request bodies", () => {
  it("never carry an id on a create: the backend assigns it", () => {
    const body = createBody({ ...EMPTY_NEW_CHANNEL, name: "Drive News", folder: "D:\\v" });
    assert.ok(!("id" in body) && !("number" in body));
    assert.deepEqual(body, { kind: "live", name: "Drive News", category: "News", folder: "D:\\v" });
    const streamBody = createBody({ ...EMPTY_NEW_CHANNEL, kind: "stream", name: "S", streamUrl: "https://a.b/c" });
    assert.ok(!("id" in streamBody) && !("folder" in streamBody));
  });

  it("send only the changed fields, never a number, the qualities in the order chosen", () => {
    const saved = live("a");
    assert.ok(isEmptyBody(patchBody(saved, liveDraft(saved))));
    assert.deepEqual(patchBody(saved, { ...liveDraft(saved), name: " Renamed " }), { name: "Renamed" });
    assert.ok(!("number" in liveDraft(saved)) && !("number" in streamDraft(stream("s"))));
    assert.deepEqual(patchBody(saved, { ...liveDraft(saved), variants: ["720p", "360p", "1080p"] }), {
      variants: ["720p", "360p", "1080p"],
    });
    assert.deepEqual(patchBody(saved, { ...liveDraft(saved), mode: "encode", captions: true, enabled: false }), {
      enabled: false,
      mode: "encode",
      captions: true,
    });
  });

  it("send a source only when it changed, and only the one the channel now plays", () => {
    const saved = live("a");
    const switched = { ...liveDraft(saved), plays: "videos" as const, videos: ["D:\\x.mp4"] };
    assert.deepEqual(patchBody(saved, switched), { videos: ["D:\\x.mp4"] });
    const backToSame = { ...switched, plays: "folder" as const };
    assert.ok(isEmptyBody(patchBody(saved, backToSame)), "the videos typed but not played are not sent");
  });

  it("send a stream row's changed fields, and nothing for a draft of the other kind", () => {
    const saved = stream("s");
    assert.deepEqual(patchBody(saved, { ...streamDraft(saved), streamUrl: "https://tv.example/new.m3u8" }), {
      streamUrl: "https://tv.example/new.m3u8",
    });
    assert.ok(isEmptyBody(patchBody(saved, liveDraft(live("a")))));
  });

  it("keep a stream's free-text category off a live form, and keep what was typed otherwise", () => {
    const typed = withKind({ ...EMPTY_NEW_CHANNEL, kind: "stream", category: "Talk", name: "N" }, "live");
    assert.deepEqual([typed.category, typed.name], ["News", "N"]);
    assert.equal(withKind({ ...EMPTY_NEW_CHANNEL, category: "Kids" }, "stream").category, "Kids");
  });
});

describe("a channel's checks", () => {
  it("disable Create with the first empty row, in the form's order, then the write state", () => {
    const empty = { ...EMPTY_NEW_CHANNEL };
    assert.equal(createReason(empty, { saving: false, unreachable: false }), "Name is required.");
    const named = { ...empty, name: "N" };
    assert.equal(createReason(named, { saving: false, unreachable: false }), "Folder is required.");
    const stream = { ...named, kind: "stream" as const, category: "" };
    assert.equal(createReason(stream, { saving: false, unreachable: false }), "Category is required.");
    assert.equal(createReason({ ...stream, category: "T" }, { saving: false, unreachable: false }), "Stream address is required.");
    const full = { ...named, folder: "D:\\v" };
    assert.equal(createReason(full, { saving: true, unreachable: false }), "Saving.");
    assert.equal(createReason(full, { saving: false, unreachable: true }), "The admin backend cannot be reached.");
    assert.equal(createReason(full, { saving: false, unreachable: false }), undefined);
  });

  it("refuse a stream address that is not http or https, with its row; plain http is fine", () => {
    const base = { ...EMPTY_NEW_CHANNEL, name: "N", folder: "D:\\v" };
    assert.equal(newChannelRefusal(base), null);
    assert.equal(newChannelRefusal({ ...base, kind: "stream", streamUrl: "http://192.168.1.4:8080/c" }), null);
    const refused = newChannelRefusal({ ...base, kind: "stream", streamUrl: "ftp://a.b/c" });
    assert.deepEqual(refused, { field: "streamUrl", sentence: "Stream address must be an http or https address." });
    assert.deepEqual(checkChannel({ ...streamDraft(stream("s")), logoUrl: "ftp://x" }).refusal?.field, "logoUrl");
  });

  it("put a backend field under its row; videos.<n> under the Videos list; others on the notice only", () => {
    assert.deepEqual(
      ["name", "videos.2", "folder", "streamUrl", "kind", "source", undefined].map(channelField),
      ["name", "videos", "folder", "streamUrl", undefined, undefined, undefined],
    );
  });
});
