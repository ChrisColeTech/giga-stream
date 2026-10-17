import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { channelState, enabledState, jobState, titleState, type LiveState } from "@/lib/row-state";

describe("a channel's state word", () => {
  it("is the engine's state for a live channel, coloured by it", () => {
    const expected: Array<[LiveState, string]> = [
      ["live", "done"],
      ["preparing", "loading"],
      ["starting", "loading"],
      ["restarting", "loading"],
      ["stopped", "faint"],
      ["failed", "failed"],
    ];
    for (const [state, tone] of expected) {
      const row = channelState({ enabled: true, state });
      assert.deepEqual([row.word, row.tone, row.dimmed], [state, tone, false], state);
    }
  });

  it("is `disabled`, dimmed, whatever the engine says: a disabled record stays in its list", () => {
    for (const state of ["live", "failed", "preparing"] as const) {
      const row = channelState({ enabled: false, state });
      assert.deepEqual([row.word, row.tone, row.dimmed], ["disabled", "faint", true], state);
    }
  });

  it("is synced, edited or manual for a stream channel, which has no engine state", () => {
    assert.equal(channelState({ enabled: true, origin: "synced" }).word, "synced");
    assert.equal(channelState({ enabled: true, origin: "edited" }).word, "edited");
    const manual = channelState({ enabled: true, origin: "manual" });
    assert.deepEqual([manual.word, manual.tone], ["manual", "accent"]);
    assert.equal(channelState({ enabled: true }).word, "manual", "no state and no origin is a channel made by hand");
    assert.equal(channelState({ enabled: false, origin: "synced" }).word, "disabled");
  });
});

describe("a title's state word", () => {
  it("is synced from TMDB, edited after an edit, manual when added by hand", () => {
    assert.equal(titleState({ enabled: true, manual: false, edited: false }).word, "synced");
    assert.equal(titleState({ enabled: true, manual: false, edited: true }).word, "edited");
    assert.equal(titleState({ enabled: true, manual: true, edited: false }).word, "manual");
  });

  it("puts manual before edited, and disabled before both", () => {
    assert.equal(titleState({ enabled: true, manual: true, edited: true }).word, "manual");
    const off = titleState({ enabled: false, manual: true, edited: true });
    assert.deepEqual([off.word, off.dimmed], ["disabled", true]);
  });

  it("colours edited like work in hand and manual in the accent", () => {
    assert.equal(titleState({ enabled: true, manual: false, edited: true }).tone, "loading");
    assert.equal(titleState({ enabled: true, manual: true, edited: false }).tone, "accent");
  });
});

describe("a job's state word", () => {
  it("ranks disabled over running over failed over idle", () => {
    assert.equal(jobState({ enabled: true, running: false, failed: false }).word, "idle");
    assert.equal(jobState({ enabled: true, running: false, failed: true }).word, "failed");
    assert.equal(jobState({ enabled: true, running: true, failed: true }).word, "running");
    const off = jobState({ enabled: false, running: true, failed: true });
    assert.deepEqual([off.word, off.dimmed], ["disabled", true]);
  });

  it("draws a running job in the working colour", () => {
    assert.equal(jobState({ enabled: true, running: true, failed: false }).tone, "loading");
  });
});

describe("a provider, playlist or account's state word", () => {
  it("is enabled or disabled, and only the disabled one is dimmed", () => {
    const on = enabledState(true);
    const off = enabledState(false);
    assert.deepEqual([on.word, on.tone, on.dimmed], ["enabled", "done", false]);
    assert.deepEqual([off.word, off.tone, off.dimmed], ["disabled", "faint", true]);
  });
});
