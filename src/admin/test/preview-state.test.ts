import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathOf, previewAddress } from "@/lib/preview-address";
import { PLAYER_IDLE, healthWord, previewLine, previewTarget } from "@/lib/preview-state";
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

  it("says `failed` for a failed channel, with its problem as the notice sentence, and a stopped one, with Retry", () => {
    const problem = live("a", { state: "failed", problem: "The folder holds no video." });
    assert.deepEqual(previewLine(problem, false, PLAYER_IDLE), {
      line: "failed",
      retry: true,
      notice: "The folder holds no video.",
    });
    assert.deepEqual(previewLine(live("a", { state: "stopped" }), false, PLAYER_IDLE), { line: "stopped", retry: true });
  });

  it("adds the player's error after a live channel's state, with Retry", () => {
    assert.deepEqual(previewLine(live("a"), false, failed("manifest failed")), { line: "live · manifest failed", retry: true });
  });

  it("says a stream channel's phase or its error", () => {
    assert.deepEqual(previewLine(stream("s"), false, { phase: "loading", error: null }), { line: "loading", retry: false });
    assert.deepEqual(previewLine(stream("s"), false, { phase: "playing", error: null }), { line: "playing", retry: false });
    assert.deepEqual(previewLine(stream("s"), false, failed("unreachable")), { line: "unreachable", retry: true });
    const unsupported = previewLine(stream("s"), false, failed("unsupported"));
    assert.deepEqual([unsupported.line, unsupported.notice], ["unsupported", "This browser cannot play HLS streams."]);
  });

  it("says `missing` for a missing channel, with Retry and the sentence as the notice; only `loading` while the read runs", () => {
    assert.deepEqual(previewLine(undefined, false, PLAYER_IDLE), {
      line: "missing",
      retry: true,
      notice: "That channel does not exist.",
    });
    assert.deepEqual(previewLine(undefined, true, PLAYER_IDLE), { line: "loading", retry: false });
  });

  it("keeps the line to words: no state of any kind puts a sentence on the line", () => {
    const states = ["live", "preparing", "starting", "restarting", "stopped", "failed"] as const;
    for (const state of states) {
      const { line } = previewLine(live("a", { state, problem: "A long sentence about why." }), false, PLAYER_IDLE);
      assert.ok(!line.includes("."), `${state}: ${line}`);
    }
  });
});

describe("the status bar's health word (`51` section 2.5)", () => {
  it("is a stream channel's verdict: online muted, offline in the failed tone, not checked faint", () => {
    assert.deepEqual(healthWord(stream("a", { status: "online" })), { word: "online", className: undefined });
    assert.deepEqual(healthWord(stream("b", { status: "offline" })), { word: "offline", className: "text-st-failed" });
    assert.deepEqual(healthWord(stream("c")), { word: "not checked", className: "text-faint" });
  });

  it("is absent for a live-kind channel or no channel: the engine word stands alone", () => {
    assert.equal(healthWord(live("a")), null);
    assert.equal(healthWord(undefined), null);
  });
});
