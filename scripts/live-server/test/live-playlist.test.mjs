import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseVirtualSegment,
  renderMasterPlaylist,
  renderMediaPlaylist,
  virtualSegmentName,
  windowAt,
} from "../live-playlist.mjs";
import { parseSegments } from "../playlist-parse.mjs";
import { FAKE_MASTER, fakeSource } from "./fake-source.mjs";

const EPOCH = Date.UTC(2026, 9, 15, 12, 0, 0);
const SEGMENTS = fakeSource(5).renditions.get("360p").segments;
const render = (elapsedMs) => renderMediaPlaylist({ segments: SEGMENTS, elapsedMs, epochMs: EPOCH });
const sequenceOf = (text) => Number(/#EXT-X-MEDIA-SEQUENCE:(\d+)/.exec(text)[1]);
const dateTimes = (text) => [...text.matchAll(/#EXT-X-PROGRAM-DATE-TIME:(\S+)/g)].map((match) => Date.parse(match[1]));
const names = (text) => text.split("\n").filter((line) => line.startsWith("seg"));

test("windowAt holds the newest six completed segments and slides one per segment length", () => {
  assert.deepEqual(windowAt({ elapsedMs: 12000 }), { first: 0, last: 5 });
  assert.deepEqual(windowAt({ elapsedMs: 14000 }), { first: 1, last: 6 });
  assert.deepEqual(windowAt({ elapsedMs: 15999 }), { first: 1, last: 6 });
  assert.deepEqual(windowAt({ elapsedMs: 1000 }), { first: 0, last: -1 });
  assert.deepEqual(windowAt({ elapsedMs: 30000, segmentMs: 1000, windowSize: 4 }), { first: 26, last: 29 });
});

test("the media sequence comes from the clock: floor(elapsed / segment length) minus the window", () => {
  assert.equal(sequenceOf(render(30000)), 9);
  assert.equal(sequenceOf(render(31999)), 9);
  assert.equal(sequenceOf(render(32000)), 10);
  assert.equal(sequenceOf(render(12000)), 0);
});

test("the window is six segments and never ends", () => {
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
  for (let index = 1; index < first.length; index += 1) assert.equal(first[index] - first[index - 1], 2000);
  const later = dateTimes(render(40000));
  assert.ok(later[0] > first[0]);
  assert.equal(later[0] - first[0], 10000);
});

test("a loop wrap carries a discontinuity, once, right before the first segment of the new cycle", () => {
  const text = render(18000); // completed 9: segments 3..8, the source has 5 so 5 starts cycle two
  assert.equal(text.match(/#EXT-X-DISCONTINUITY\n/g).length, 1);
  assert.match(text, /#EXT-X-DISCONTINUITY\n#EXT-X-PROGRAM-DATE-TIME:\S+\n#EXTINF:2.000,\nseg00005.ts/);
  assert.equal(text.includes("#EXT-X-DISCONTINUITY-SEQUENCE"), false);
});

test("wraps that left the window are counted in the discontinuity sequence", () => {
  const text = render(24000); // completed 12: window 6..11, the wrap at 5 is gone, the wrap at 10 is inside
  assert.match(text, /#EXT-X-MEDIA-SEQUENCE:6\n#EXT-X-DISCONTINUITY-SEQUENCE:1\n/);
  assert.equal(text.match(/#EXT-X-DISCONTINUITY\n/g).length, 1);
  const later = render(40000); // completed 20: window 14..19, wrap at 15 inside, wraps at 5 and 10 gone
  assert.match(later, /#EXT-X-DISCONTINUITY-SEQUENCE:2\n/);
});

test("the source segments repeat in order across the loop", () => {
  const parsed = parseSegments(render(26000)); // window 7..12 maps to source 2,3,4,0,1,2
  assert.equal(parsed.length, 6);
  assert.deepEqual(parsed.map((segment) => segment.duration), [2, 2, 2, 2, 2, 2]);
});

test("an empty start renders an empty but valid playlist", () => {
  const text = render(500);
  assert.equal(names(text).length, 0);
  assert.match(text, /#EXT-X-MEDIA-SEQUENCE:0\n/);
});

test("the master lists every video level and the audio group, pointing at the virtual routes", () => {
  const master = renderMasterPlaylist(FAKE_MASTER);
  assert.match(master, /^#EXTM3U\n#EXT-X-INDEPENDENT-SEGMENTS\n/);
  assert.equal((master.match(/RESOLUTION=/g) ?? []).length, 2);
  assert.match(master, /GROUP-ID="aud".*URI="audio\/index.m3u8"/);
  assert.match(master, /AUDIO="aud"/);
  assert.match(master, /\n360p\/index.m3u8\n/);
  assert.match(master, /\n720p\/index.m3u8\n/);
});

test("playlist names that are not folders are rewritten to a rendition folder", () => {
  const master = renderMasterPlaylist(
    '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="en",URI="subs_vtt.m3u8"\n',
  );
  assert.match(master, /URI="subs_vtt\/index.m3u8"/);
});
