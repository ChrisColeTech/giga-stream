import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseVirtualSegment,
  renderMasterPlaylist,
  renderMediaPlaylist,
  virtualSegmentName,
  windowAt,
} from "../src/live/stream/live-playlist.js";
import { parseSegments } from "../src/live/stream/playlist-parse.js";
import { FAKE_MASTER, fakeSchedule, fakeSource } from "./live-fake-source.js";

const EPOCH = Date.UTC(2026, 9, 15, 12, 0, 0);
const SEGMENTS = fakeSource(5).renditions.get("360p")?.segments ?? [];
const render = (elapsedMs: number) => renderMediaPlaylist({ segments: SEGMENTS, elapsedMs, epochMs: EPOCH });
const sequenceOf = (text: string) => Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(text)?.[1]);
const dateTimes = (text: string) => [...text.matchAll(/#EXT-X-PROGRAM-DATE-TIME:(\S+)/g)].map((m) => Date.parse(m[1] ?? ""));
const names = (text: string) => text.split("\n").filter((line) => line.startsWith("seg"));
const count = (text: string, pattern: RegExp) => text.match(pattern)?.length ?? 0;

test("windowAt holds the newest six completed segments and slides one per segment length", () => {
  assert.deepEqual(windowAt({ elapsedMs: 12000 }), { first: 0, last: 5 });
  assert.deepEqual(windowAt({ elapsedMs: 14000 }), { first: 1, last: 6 });
  assert.deepEqual(windowAt({ elapsedMs: 15999 }), { first: 1, last: 6 });
  assert.deepEqual(windowAt({ elapsedMs: 1000 }), { first: 0, last: -1 });
  assert.deepEqual(windowAt({ elapsedMs: 30000, segmentMs: 1000, windowSize: 4 }), { first: 26, last: 29 });
});

test("the media sequence comes from the clock and the window is six segments that never end", () => {
  assert.deepEqual([30000, 31999, 32000, 12000].map((ms) => sequenceOf(render(ms))), [9, 9, 10, 0]);
  for (const elapsed of [12000, 30000, 101000, 3_600_000]) {
    const text = render(elapsed);
    assert.equal(names(text).length, 6, `elapsed ${elapsed}`);
    assert.equal(text.includes("#EXT-X-ENDLIST"), false);
    assert.match(text, /^#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n/);
  }
});

test("segment names are the virtual numbers with the source extension", () => {
  assert.deepEqual(names(render(30000)), [9, 10, 11, 12, 13, 14].map((n) => `seg${String(n).padStart(5, "0")}.ts`));
  assert.equal(virtualSegmentName(7, "ts"), "seg00007.ts");
  assert.deepEqual(parseVirtualSegment("seg00123.vtt"), { number: 123, extension: "vtt" });
  assert.equal(parseVirtualSegment("../seg00001.ts"), null);
  assert.equal(parseVirtualSegment("seg1.ts"), null);
});

test("program date-time is the epoch plus the segment number times its length, and only moves forward", () => {
  const first = dateTimes(render(30000));
  assert.equal(first[0], EPOCH + 9 * 2000);
  for (let index = 1; index < first.length; index += 1) assert.equal((first[index] ?? 0) - (first[index - 1] ?? 0), 2000);
  assert.equal((dateTimes(render(40000))[0] ?? 0) - (first[0] ?? 0), 10000);
});

test("a loop wrap carries a discontinuity, and wraps that left the window are counted", () => {
  const text = render(18000); // window 3..8; the source has 5, so 5 starts cycle two
  assert.equal(count(text, /#EXT-X-DISCONTINUITY\n/g), 1);
  assert.match(text, /#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:\S+\n#EXTINF:2.000,\nseg00005.ts/);
  assert.equal(text.includes("#EXT-X-DISCONTINUITY-SEQUENCE"), false);
  assert.match(render(24000), /#EXT-X-MEDIA-SEQUENCE:6\n#EXT-X-DISCONTINUITY-SEQUENCE:1\n/); // window 6..11
  assert.match(render(40000), /#EXT-X-DISCONTINUITY-SEQUENCE:2\n/); // window 14..19
});

test("in a playlist every switch to the next video is a discontinuity, and the gone ones are counted", () => {
  const segments = fakeSchedule().renditions.get("360p")?.segments ?? []; // a: 0..2, b: 3..4, cycle of 5
  const at = (elapsedMs: number) => renderMediaPlaylist({ segments, elapsedMs, epochMs: EPOCH });
  const early = at(18000); // window 3..8: b starts at 3, a at 5, b at 8
  assert.equal(count(early, /#EXT-X-DISCONTINUITY\n/g), 3);
  for (const n of [3, 5, 8]) assert.match(early, new RegExp(`#EXT-X-DISCONTINUITY\\n[^\\n]+\\n[^\\n]+\\nseg0000${n}\\.ts`));
  const later = at(32000); // window 10..15: gone switches at 3, 5, 8; inside at 10, 13, 15
  assert.match(later, /#EXT-X-MEDIA-SEQUENCE:10\n#EXT-X-DISCONTINUITY-SEQUENCE:3\n/);
  assert.equal(count(later, /#EXT-X-DISCONTINUITY\n/g), 3);
});

test("the source segments repeat in order, and an empty start is a valid empty playlist", () => {
  assert.deepEqual(parseSegments(render(26000)).map((segment) => segment.duration), [2, 2, 2, 2, 2, 2]);
  const empty = render(500);
  assert.equal(names(empty).length, 0);
  assert.match(empty, /#EXT-X-MEDIA-SEQUENCE:0\n/);
});

test("the master lists every video level and the audio group, pointing at the virtual routes", () => {
  const master = renderMasterPlaylist(FAKE_MASTER);
  assert.match(master, /^#EXTM3U\n#EXT-X-INDEPENDENT-SEGMENTS\n/);
  assert.equal(count(master, /RESOLUTION=/g), 2);
  assert.match(master, /GROUP-ID="aud".*URI="audio\/index.m3u8"/);
  assert.match(master, /\n360p\/index.m3u8\n/);
  assert.match(master, /\n720p\/index.m3u8\n/);
  const subs = renderMasterPlaylist('#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="en",URI="subs_vtt.m3u8"\n');
  assert.match(subs, /URI="subs_vtt\/index.m3u8"/);
});
