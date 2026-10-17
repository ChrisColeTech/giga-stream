import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlayerProgress, PROGRESS_INTERVAL_MS } from "@/lib/player-progress";
import { attemptPlayerPlay, openingPosition, shouldAttemptPlay } from "@/lib/player-opening";
import type { WatchWrite } from "@/services/watch";

describe("watch progress", () => {
  it("uses the documented 30 second active cadence", () => {
    assert.equal(PROGRESS_INTERVAL_MS, 30_000);
  });

  it("uses one playback id, monotonic sequence numbers, and the exact episode", async () => {
    const writes: WatchWrite[] = [];
    const progress = new PlayerProgress(
      { item: { kind: "title", id: "tv-1" }, season: 2, episode: 4 },
      true,
      async (write) => { writes.push(write); },
      "playback-1",
    );
    progress.update(30_001, 60_000);
    await progress.flush();
    progress.update(35_000, 60_000);
    await progress.flush();
    assert.deepEqual(writes.map((write) => [write.playbackId, write.seq]), [["playback-1", 1], ["playback-1", 2]]);
    assert.deepEqual(writes.map((write) => [write.season, write.episode]), [[2, 4], [2, 4]]);
  });

  it("suppresses every write while history is paused and does not write before media reports a position", async () => {
    const writes: WatchWrite[] = [];
    const progress = new PlayerProgress({ item: { kind: "local", id: "one" } }, false, async (write) => {
      writes.push(write);
    }, "playback-2");
    await progress.flush();
    progress.update(10_000, 20_000);
    await progress.flush();
    assert.deepEqual(writes, []);
  });

  it("keeps pause, end, close, and source-switch boundaries monotonic even when writes settle late", async () => {
    const writes: WatchWrite[] = [];
    const progress = new PlayerProgress({ item: { kind: "title", id: "movie-1" } }, true, async (write) => {
      writes.push(write);
    }, "playback-3");
    progress.update(10_000, 100_000);
    const boundaries = [progress.flush(), progress.flush(), progress.flush(), progress.flush()];
    await Promise.all(boundaries.reverse());
    assert.deepEqual(writes.map((write) => write.seq), [1, 2, 3, 4]);
    assert.equal(new Set(writes.map((write) => write.playbackId)).size, 1);
  });
});

describe("resume and autoplay modes", () => {
  const watching = { positionMs: 12_000, durationMs: 60_000, state: "watching" as const };
  it("asks at zero, resumes exactly, and restarts at zero", () => {
    assert.equal(openingPosition("ask", watching), 0);
    assert.equal(openingPosition("resume", watching), 12_000);
    assert.equal(openingPosition("restart", watching), 0);
  });

  it("always attempts a clicked play, while unattended play follows autoplay", () => {
    assert.equal(shouldAttemptPlay(false, true), true);
    assert.equal(shouldAttemptPlay(false, false), false);
    assert.equal(shouldAttemptPlay(true, false), true);
  });

  it("leaves media paused and unmuted when play is refused", async () => {
    let refused = false;
    const media = { muted: false, paused: true, play: () => Promise.reject(new Error("refused")) };
    attemptPlayerPlay(media, true, false, () => { refused = true; });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(refused, true);
    assert.equal(media.paused, true);
    assert.equal(media.muted, false);
  });
});
