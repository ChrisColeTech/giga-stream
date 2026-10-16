import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detailRows } from "@/lib/live-details";
import { EMPTY_VALUE } from "@/lib/live-constants";
import { objectFitOf, PICTURE_FIT_OPTIONS } from "@/lib/live-picture";
import { statusDot, statusWord } from "@/lib/live-status";
import { stageStateFor } from "@/lib/live-stage";
import { CHANNEL_LIST } from "@/fixtures/channels";

describe("status dot", () => {
  it("maps live to done, offline to failed and an unprobed channel to the queued grey", () => {
    assert.equal(statusDot("live"), "done");
    assert.equal(statusDot("offline"), "failed");
    assert.equal(statusDot("unknown"), "queued");
  });

  it("gives every status a word for assistive technology", () => {
    assert.equal(statusWord("live"), "Live");
    assert.equal(statusWord("offline"), "Offline");
    assert.equal(statusWord("unknown"), "Not checked");
  });
});

describe("stage state", () => {
  it("is ready with channels and no channels when the list is empty", () => {
    assert.equal(stageStateFor(CHANNEL_LIST.items.length), "ready");
    assert.equal(stageStateFor(0), "no-channels");
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
    const channel = CHANNEL_LIST.items[0];
    assert.ok(channel !== undefined);
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
