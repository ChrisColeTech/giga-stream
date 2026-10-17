import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detailRows } from "@/lib/live-details";
import { channelListRender } from "@/lib/live-channels";
import { EMPTY_VALUE } from "@/lib/live-constants";
import { objectFitOf, PICTURE_FIT_OPTIONS } from "@/lib/live-picture";
import { statusBar, statusWord } from "@/lib/live-status";
import { channelListUnavailable, stageStateFor } from "@/lib/live-stage";
import type { Channel } from "@/types/channel";

const channel: Channel = {
  id: "news",
  name: "Fixture News",
  category: "News",
  number: "1",
  revision: 1,
  streamUrl: "https://stream.test/news.m3u8",
  status: "live",
};

describe("status bar", () => {
  it("maps live to success, offline to error and an unprobed channel to inactive", () => {
    assert.equal(statusBar("live"), "success");
    assert.equal(statusBar("offline"), "error");
    assert.equal(statusBar("unknown"), "inactive");
  });

  it("gives every status a word for the meta line", () => {
    assert.equal(statusWord("live"), "Live");
    assert.equal(statusWord("offline"), "Offline");
    assert.equal(statusWord("unknown"), "Not checked");
  });
});

describe("stage state", () => {
  it("is ready with channels and no channels when the list is empty", () => {
    assert.equal(stageStateFor(1), "ready");
    assert.equal(stageStateFor(0), "no-channels");
  });

  it("keeps a hydrated disconnected empty view unavailable until a channel read succeeds", () => {
    assert.equal(channelListUnavailable({ connected: false }, false), true);
    assert.equal(channelListUnavailable({ connected: false }, true), false);
    assert.equal(channelListUnavailable({ connected: true }, false), false);
  });
});

describe("channel list rendering", () => {
  it("uses established skeletons for pending, unavailable and no-match lists", () => {
    assert.equal(channelListRender(true, 0), "skeleton");
    assert.equal(channelListRender(false, 0), "skeleton");
    assert.equal(channelListRender(false, 2), "rows");
  });
});

describe("picture fit", () => {
  it("maps Fit to contain, Fill to cover and Original to none", () => {
    assert.equal(objectFitOf("fit"), "contain");
    assert.equal(objectFitOf("fill"), "cover");
    assert.equal(objectFitOf("original"), "none");
  });

  it("offers Fit, Fill and Original in that order", () => {
    assert.deepEqual(
      PICTURE_FIT_OPTIONS.map((option) => option.value),
      ["fit", "fill", "original"],
    );
  });
});

describe("channel details", () => {
  it("lists name, category, number and revision of the channel", () => {
    assert.deepEqual(detailRows(channel), [
      { label: "name", value: channel.name },
      { label: "category", value: channel.category },
      { label: "number", value: channel.number ?? EMPTY_VALUE },
      { label: "revision", value: String(channel.revision) },
    ]);
  });

  it("shows a dash for every value when nothing is selected", () => {
    assert.deepEqual(
      detailRows(null).map((row) => row.value),
      [EMPTY_VALUE, EMPTY_VALUE, EMPTY_VALUE, EMPTY_VALUE],
    );
  });
});
