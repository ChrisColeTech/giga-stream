import assert from "node:assert/strict";
import { test } from "node:test";

import { createLoopChannel } from "../loop-channel.mjs";
import { fakeSource } from "./fake-source.mjs";

const START = Date.UTC(2026, 9, 15, 12, 0, 0);
const CHANNEL = { id: "fx-news" };

/** A loop channel over a 5-segment fake source with a clock the test moves by hand. */
function setup(count = 5) {
  const clock = { now: START };
  const channel = createLoopChannel({ channel: CHANNEL, source: fakeSource(count), clock: () => clock.now });
  return { clock, channel };
}
const text = async (channel, ...parts) => (await channel.read(parts))?.toString() ?? null;
const sequenceOf = (body) => Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(body)[1]);

test("the first playlist is already a full window, as if the stream had been running", async () => {
  const { channel } = setup();
  const body = await text(channel, "360p", "index.m3u8");
  assert.equal(sequenceOf(body), 0);
  assert.equal(body.match(/^seg\d{5}\.ts$/gm).length, 6);
  assert.equal(body.includes("#EXT-X-ENDLIST"), false);
  assert.equal(Date.parse(/#EXT-X-PROGRAM-DATE-TIME:(\S+)/.exec(body)[1]), START - 12000);
});

test("the window advances by one segment every two seconds of the clock", async () => {
  const { clock, channel } = setup();
  const sequences = [];
  for (let step = 0; step < 4; step += 1) {
    sequences.push(sequenceOf(await text(channel, "720p", "index.m3u8")));
    clock.now += 1999;
    sequences.push(sequenceOf(await text(channel, "720p", "index.m3u8")));
    clock.now += 1;
  }
  assert.deepEqual(sequences, [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("virtual segments map onto source segments across a loop wrap", async () => {
  const { clock, channel } = setup(5);
  assert.equal(await text(channel, "360p", "seg00004.ts"), "360p:4");
  assert.equal(await text(channel, "360p", "seg00005.ts"), "360p:0"); // the first repeat
  clock.now += 12000; // newest complete segment is now 11
  assert.equal(await text(channel, "360p", "seg00007.ts"), "360p:2");
  assert.equal(await text(channel, "720p", "seg00010.ts"), "720p:0");
  assert.equal(await text(channel, "audio", "seg00011.ts"), "audio:1");
});

test("the wrap carries a discontinuity and the count of wraps that left the window", async () => {
  const { clock, channel } = setup(5);
  clock.now += 12000; // window 6..11, wrap at 10
  const body = await text(channel, "360p", "index.m3u8");
  assert.equal(body.match(/#EXT-X-DISCONTINUITY\n/g).length, 1);
  assert.match(body, /#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:\S+\n#EXTINF:2.000,\nseg00010.ts/);
  assert.match(body, /#EXT-X-DISCONTINUITY-SEQUENCE:1\n/);
});

test("a segment that is not published yet, or is long gone, is not found", async () => {
  const { clock, channel } = setup(5);
  assert.equal(await text(channel, "360p", "seg00006.ts"), null); // the future
  clock.now += 2000 * 100;
  const body = await text(channel, "360p", "index.m3u8");
  const newest = sequenceOf(body) + 5;
  assert.equal(await text(channel, "360p", `seg${String(newest).padStart(5, "0")}.ts`) !== null, true);
  assert.equal(await text(channel, "360p", "seg00010.ts"), null); // far behind the window
});

test("the master points at the virtual routes and lists every rendition", async () => {
  const { channel } = setup();
  const master = await text(channel, "master.m3u8");
  assert.match(master, /\n360p\/index.m3u8\n/);
  assert.match(master, /\n720p\/index.m3u8\n/);
  assert.match(master, /URI="audio\/index.m3u8"/);
  assert.deepEqual(channel.renditions(), ["360p", "720p", "audio"]);
});

test("unknown renditions, names and shapes are not found", async () => {
  const { channel } = setup();
  assert.equal(await text(channel, "1080p", "index.m3u8"), null);
  assert.equal(await text(channel, "1080p", "seg00001.ts"), null);
  assert.equal(await text(channel, "360p", "seg1.ts"), null);
  assert.equal(await text(channel, "360p", "other.bin"), null);
  assert.equal(await text(channel, "index.m3u8"), null);
  assert.equal(await text(channel, "a", "b", "c"), null);
});

test("a loop channel is always live, has no encoder and stops without effect", async () => {
  const { channel } = setup();
  assert.equal(channel.mode, "loop");
  assert.equal(channel.state(), "live");
  await channel.start();
  await channel.stop();
  assert.equal(channel.state(), "live");
});
