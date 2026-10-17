import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlayerProgress, ProgressBeginQueue } from "@/lib/player-progress";
import {
  applyOpeningPosition, attemptPlayerPlay, openingPosition, reportedDuration, shouldAttemptPlay,
} from "@/lib/player-opening";
import type { WatchWrite } from "@/services/watch";

const recorder = (writes: WatchWrite[], keepalives: boolean[] = [], enabled = true) =>
  new PlayerProgress({ item: { kind: "title", id: "movie-1" } }, enabled, async (write, keepalive) => {
    writes.push(write);
    keepalives.push(keepalive);
  }, "playback-x", "key-x");

describe("watch progress writes", () => {
  it("open writes the item once, at its starting position and with no invented duration", async () => {
    const writes: WatchWrite[] = [];
    const progress = recorder(writes);
    await progress.open(125_000);
    assert.equal(progress.open(0), undefined, "a second open of the same playback writes nothing");
    assert.deepEqual(writes, [{ item: { kind: "title", id: "movie-1" }, positionMs: 125_000, playbackId: "playback-x", seq: 1 }]);
    assert.equal(progress.key, "key-x");
  });

  it("throttles by media time: a report inside ten seconds writes nothing, ten seconds on or a seek writes", async () => {
    const writes: WatchWrite[] = [];
    const progress = recorder(writes);
    await progress.open(0);
    assert.equal(progress.update(2_000), undefined);
    assert.equal(progress.update(9_999), undefined);
    await progress.update(10_000);
    assert.equal(progress.update(15_000), undefined);
    await progress.update(75_000);
    await progress.update(30_000);
    assert.deepEqual(writes.map((write) => write.positionMs), [0, 10_000, 75_000, 30_000]);
    assert.deepEqual(writes.map((write) => write.seq), [1, 2, 3, 4]);
  });

  it("writes once more the first time the real duration is known, then keeps it through reports without one", async () => {
    const writes: WatchWrite[] = [];
    const progress = recorder(writes);
    await progress.open(0);
    await progress.update(0, 7_200_000);
    assert.equal(progress.update(1_000, 7_200_000), undefined, "the duration is not news twice");
    await progress.update(12_000);
    assert.deepEqual(writes.map((write) => write.durationMs), [undefined, 7_200_000, 7_200_000]);
    assert.equal(progress.update(13_000, Number.POSITIVE_INFINITY), undefined, "an unknown length is ignored");
  });

  it("restart writes zero, and a boundary flush carries the last position through keepalive when asked", async () => {
    const writes: WatchWrite[] = [];
    const keepalives: boolean[] = [];
    const progress = recorder(writes, keepalives);
    await progress.update(500_000, 1_000_000);
    await progress.restart();
    progress.update(3_000);
    await progress.flush(true);
    await progress.flush();
    assert.deepEqual(writes.map((write) => write.positionMs), [500_000, 0, 3_000, 3_000]);
    assert.deepEqual(keepalives, [false, false, true, false]);
  });

  it("an update before open still writes the first report, and a flush before any report writes nothing", async () => {
    const writes: WatchWrite[] = [];
    const progress = recorder(writes);
    await progress.flush();
    assert.deepEqual(writes, []);
    await progress.update(4_000);
    assert.equal(progress.open(0), undefined, "the first report opened the playback");
    assert.equal(writes.length, 1);
  });
});

describe("watch progress", () => {
  it("applies the opening position only to media with a real length", () => {
    const vod = { currentTime: 0, duration: 3600 };
    applyOpeningPosition(vod, 90_000);
    assert.equal(vod.currentTime, 90);
    const live = { currentTime: 0, duration: Number.POSITIVE_INFINITY };
    applyOpeningPosition(live, 90_000);
    assert.equal(live.currentTime, 0);
  });

  it("carries a provider's runtime only for a provider's embedded player", () => {
    assert.equal(reportedDuration(5_400_000, { kind: "embed" }, 7_200_000), 5_400_000);
    assert.equal(reportedDuration(undefined, { kind: "embed" }, 7_200_000), 7_200_000);
    assert.equal(reportedDuration(undefined, { kind: "stream" }, 7_200_000), undefined);
    assert.equal(reportedDuration(undefined, undefined, 7_200_000), undefined);
  });

  it("uses one playback id, monotonic sequence numbers, and the exact episode", async () => {
    const writes: WatchWrite[] = [];
    const progress = new PlayerProgress(
      { item: { kind: "title", id: "tv-1" }, season: 2, episode: 4 },
      true,
      async (write) => { writes.push(write); },
      "playback-1",
    );
    await progress.update(30_001, 60_000);
    await progress.flush();
    progress.update(35_000, 60_000);
    await progress.flush();
    assert.deepEqual(writes.map((write) => [write.playbackId, write.seq]), [
      ["playback-1", 1], ["playback-1", 2], ["playback-1", 3],
    ]);
    assert.deepEqual(writes.map((write) => [write.season, write.episode]), [[2, 4], [2, 4], [2, 4]]);
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
    const first = progress.update(10_000, 100_000);
    const boundaries = [first, progress.flush(), progress.flush(), progress.flush()];
    await Promise.all(boundaries.reverse());
    assert.deepEqual(writes.map((write) => write.seq), [1, 2, 3, 4]);
    assert.equal(new Set(writes.map((write) => write.playbackId)).size, 1);
  });

  it("serializes deferred begins and lets only the latest completion install a recorder", async () => {
    const queue = new ProgressBeginQueue();
    const calls: string[] = [];
    let releaseA: () => void = () => undefined;
    let releaseB: () => void = () => undefined;
    const a = new Promise<void>((resolve) => { releaseA = resolve; });
    const b = new Promise<void>((resolve) => { releaseB = resolve; });
    const beginA = queue.begin(async () => { calls.push("flush-a"); await a; }, () => calls.push("install-a"));
    await Promise.resolve();
    const beginB = queue.begin(async () => { calls.push("flush-b"); await b; }, () => calls.push("install-b"));
    releaseA();
    await beginA;
    await Promise.resolve();
    releaseB();
    await beginB;
    assert.deepEqual(calls, ["flush-a", "flush-b", "install-b"]);
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
