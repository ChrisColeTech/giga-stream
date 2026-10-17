import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUDIO_CHOICES, AUDIO_DEFAULT, CAPTION_CHOICES, audioOption, audioTag, latencyOption, qualityOf } from "@/lib/playback-prefs";

describe("the playback preferences", () => {
  it("reads a quality choice, and anything unknown as Auto", () => {
    assert.equal(qualityOf("higher"), "higher");
    assert.equal(qualityOf("saver"), "saver");
    assert.equal(qualityOf("8k"), "auto");
  });

  it("stores the stream's default audio as null and any language as its tag", () => {
    assert.equal(audioTag(AUDIO_DEFAULT), null);
    assert.equal(audioTag("es"), "es");
    assert.equal(audioOption(null), AUDIO_DEFAULT);
    assert.equal(audioOption("es"), "es");
  });

  it("offers the stream default first for audio and Off first for captions", () => {
    assert.equal(AUDIO_CHOICES[0]?.label, "Stream default");
    assert.equal(AUDIO_CHOICES.some((choice) => choice.label === "Off"), false);
    assert.equal(CAPTION_CHOICES[0]?.label, "Off");
  });

  it("maps low latency to its choice", () => {
    assert.equal(latencyOption(true), "low");
    assert.equal(latencyOption(false), "normal");
  });
});
