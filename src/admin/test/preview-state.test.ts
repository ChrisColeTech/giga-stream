import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathOf, previewAddress } from "@/lib/preview-address";
import { PLAYER_IDLE, previewLine, previewTarget } from "@/lib/preview-state";
import { live, stream } from "./support/channels-kit";

const failed = (error: "manifest failed" | "unreachable" | "media error" | "unsupported") => ({ phase: "idle" as const, error });

describe("what the Preview attaches", () => {
  it("plays a live channel on the path of its streamUrl, on the page's own origin", () => {
    assert.equal(previewAddress(live("a")), "/live/a/master.m3u8");
    assert.equal(pathOf("not an address"), "not an address");
  });

  it("plays a stream channel's streamUrl as answered, always", () => {
    assert.deepEqual(previewTarget(stream("s"), false), { address: "https://tv.example/s.m3u8", skeleton: false });
  });

  it("attaches a live channel only while live or restarting", () => {
    for (const state of ["live", "restarting"] as const) {
      assert.deepEqual(previewTarget(live("a", { state }), false), { address: "/live/a/master.m3u8", skeleton: false });
    }
  });

  it("shows the skeleton and attaches nothing while preparing or starting, or while the read runs", () => {
    for (const state of ["preparing", "starting"] as const) {
      assert.deepEqual(previewTarget(live("a", { state }), false), { address: null, skeleton: true });
    }
    assert.deepEqual(previewTarget(live("a"), true), { address: null, skeleton: true });
  });

  it("attaches nothing for a stopped or failed channel, or a missing one", () => {
    assert.deepEqual(previewTarget(live("a", { state: "stopped" }), false), { address: null, skeleton: false });
    assert.deepEqual(previewTarget(live("a", { state: "failed" }), false), { address: null, skeleton: false });
    assert.deepEqual(previewTarget(undefined, false), { address: null, skeleton: false });
  });
});

describe("the Preview's status line", () => {
  it("says a live channel's state, and offers no Retry while it plays", () => {
    assert.deepEqual(previewLine(live("a"), false, PLAYER_IDLE), { line: "live", retry: false });
    assert.deepEqual(previewLine(live("a", { state: "preparing" }), false, PLAYER_IDLE), { line: "preparing", retry: false });
  });

  it("says why a failed channel failed, and a stopped one, with Retry", () => {
    const problem = live("a", { state: "failed", problem: "The folder holds no video." });
    assert.deepEqual(previewLine(problem, false, PLAYER_IDLE), { line: "failed · The folder holds no video.", retry: true });
    assert.deepEqual(previewLine(live("a", { state: "stopped" }), false, PLAYER_IDLE), { line: "stopped", retry: true });
  });

  it("adds the player's error after a live channel's state, with Retry", () => {
    assert.deepEqual(previewLine(live("a"), false, failed("manifest failed")), { line: "live · manifest failed", retry: true });
  });

  it("says a stream channel's phase or its error", () => {
    assert.deepEqual(previewLine(stream("s"), false, { phase: "loading", error: null }), { line: "loading", retry: false });
    assert.deepEqual(previewLine(stream("s"), false, { phase: "playing", error: null }), { line: "playing", retry: false });
    assert.deepEqual(previewLine(stream("s"), false, failed("unreachable")), { line: "unreachable", retry: true });
    assert.equal(previewLine(stream("s"), false, failed("unsupported")).line, "This browser cannot play HLS streams.");
  });

  it("says a missing channel does not exist, with Retry; and only `loading` while the read runs", () => {
    assert.deepEqual(previewLine(undefined, false, PLAYER_IDLE), { line: "That channel does not exist.", retry: true });
    assert.deepEqual(previewLine(undefined, true, PLAYER_IDLE), { line: "loading", retry: false });
  });
});
