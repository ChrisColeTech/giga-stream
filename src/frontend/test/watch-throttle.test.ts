import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WATCH_WRITE_EVERY_MS, writeDue } from "@/lib/watch-throttle";

describe("the progress write throttle", () => {
  it("is ten seconds of media time", () => {
    assert.equal(WATCH_WRITE_EVERY_MS, 10_000);
  });

  it("always writes the first position of a playback", () => {
    assert.equal(writeDue(undefined, 0), true);
  });

  it("waits until media time has moved the whole interval", () => {
    assert.equal(writeDue(60_000, 60_000), false);
    assert.equal(writeDue(60_000, 69_999), false);
    assert.equal(writeDue(60_000, 70_000), true);
  });

  it("writes at once after a seek in either direction, and not for a small rewind", () => {
    assert.equal(writeDue(60_000, 600_000), true);
    assert.equal(writeDue(600_000, 60_000), true);
    assert.equal(writeDue(60_000, 55_000), false);
  });
});
