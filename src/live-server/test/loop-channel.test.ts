import assert from "node:assert/strict";
import { test } from "node:test";

import { createLoopChannel } from "../src/stream/loop-channel.ts";
import { joinSchedule } from "../src/stream/loop-source.ts";
import type { LoopSource } from "../src/types/stream.ts";
import { fakeSchedule, fakeSource } from "./fake-source.ts";

const START = Date.UTC(2026, 9, 15, 12, 0, 0);

/** A loop channel over `source` with a clock the test moves by hand. */
function setup(source: LoopSource = fakeSource(5)) {
  const clock = { now: START };
  return { clock, channel: createLoopChannel(source, { clock: () => clock.now }) };
}
const text = async (channel: ReturnType<typeof setup>["channel"], ...parts: string[]) =>
  (await channel.read(parts))?.toString() ?? null;
const sequenceOf = (body: string | null) => Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(body ?? "")?.[1]);

test("the first playlist is already a full window, as if the stream had been running", async () => {
  const { channel } = setup();
  const body = await text(channel, "360p", "index.m3u8");
  assert.equal(sequenceOf(body), 0);
  assert.equal(body?.match(/^seg\d{5}\.ts$/gm)?.length, 6);
  assert.equal(Date.parse(/#EXT-X-PROGRAM-DATE-TIME:(\S+)/.exec(body ?? "")?.[1] ?? ""), START - 12000);
});

test("the window advances by one segment every two seconds of the clock", async () => {
  const { clock, channel } = setup();
  const sequences: number[] = [];
  for (let step = 0; step < 4; step += 1) {
    sequences.push(sequenceOf(await text(channel, "720p", "index.m3u8")));
    clock.now += 1999;
    sequences.push(sequenceOf(await text(channel, "720p", "index.m3u8")));
    clock.now += 1;
  }
  assert.deepEqual(sequences, [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("virtual segments map onto source segments across a wrap; the future and the long gone are absent", async () => {
  const { clock, channel } = setup(fakeSource(5));
  assert.equal(await text(channel, "360p", "seg00004.ts"), "360p:4");
  assert.equal(await text(channel, "360p", "seg00005.ts"), "360p:0");
  assert.equal(await text(channel, "360p", "seg00006.ts"), null);
  clock.now += 12000;
  assert.equal(await text(channel, "720p", "seg00010.ts"), "720p:0");
  assert.equal(await text(channel, "audio", "seg00011.ts"), "audio:1");
  clock.now += 200_000;
  assert.equal(await text(channel, "360p", "seg00010.ts"), null);
});

test("a playlist channel plays its videos in order, says which is on, and loops back to the first", async () => {
  const { clock, channel } = setup(fakeSchedule());
  assert.deepEqual(channel.playlist(), [{ name: "a.mp4", durationMs: 6000 }, { name: "b.mp4", durationMs: 4000 }]);
  const reads = await Promise.all([0, 1, 2, 3, 4, 5].map((n) => text(channel, "720p", `seg0000${n}.ts`)));
  assert.deepEqual(reads, ["720p:0", "720p:1", "720p:2", "720p:0", "720p:1", "720p:0"]);
  assert.deepEqual(channel.nowPlaying(), { index: 0, name: "a.mp4" }); // newest complete: 5
  clock.now += 6000;
  assert.deepEqual(channel.nowPlaying(), { index: 1, name: "b.mp4" });
  clock.now += 4000;
  assert.deepEqual(channel.nowPlaying(), { index: 0, name: "a.mp4" });
});

test("a schedule refuses videos whose renditions would switch out of step", () => {
  const uneven = fakeSource(3);
  uneven.renditions.get("audio")?.segments.push({ uri: "seg003.ts", duration: 2 });
  assert.throws(() => joinSchedule([uneven], [{ name: "x.mp4", durationMs: 6000 }]), /x\.mp4: its renditions differ/);
});

test("the master points at the virtual routes; unknown renditions, names and shapes are absent", async () => {
  const { channel } = setup();
  assert.match((await text(channel, "master.m3u8")) ?? "", /\n360p\/index.m3u8\n/);
  assert.deepEqual(channel.renditions(), ["360p", "720p", "audio"]);
  for (const parts of [["1080p", "index.m3u8"], ["360p", "seg1.ts"], ["360p", "other.bin"], ["index.m3u8"], ["a", "b", "c"]]) {
    assert.equal(await text(channel, ...parts), null, parts.join("/"));
  }
  assert.equal(channel.state(), "live");
});
