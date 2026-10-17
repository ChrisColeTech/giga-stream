import assert from "node:assert/strict";
import { test } from "node:test";

import { buildEncoderArgs } from "../src/live/stream/encoder-args.js";
import { joinCaptions, shiftCaptions } from "../src/live/stream/encoder-inputs.js";
import { buildLoopSourceArgs } from "../src/live/stream/loop-source-args.js";
import { type RecipeChannel, renditionNames } from "../src/live/stream/recipe.js";

const plain: RecipeChannel = { id: "plain", captions: false, variants: ["360p", "720p"] };
const three: RecipeChannel = { id: "three", captions: false, variants: ["360p", "720p", "1080p"] };
const captioned: RecipeChannel = { id: "cc", captions: true, variants: ["360p", "720p"] };
const item = { name: "a.mp4", path: "C:/v/a.mp4", durationMs: 31_021, sizeBytes: 1, modifiedMs: 1, captionsPath: "C:/v/a.en.srt" };
const inputs = { listPath: "C:/in/list.txt", captionsPath: "C:/in/captions.srt" };

/** Every value that follows `flag`, in order (a flag may repeat). */
const valuesOf = (args: string[], flag: string) => args.flatMap((arg, index) => (arg === flag ? [args[index + 1]] : []));
const valueOf = (args: string[], flag: string) => valuesOf(args, flag)[0];

test("encode mode reads the playlist with the concat demuxer in real time, looped, into a 6-segment window", () => {
  const args = buildEncoderArgs(plain, { listPath: inputs.listPath });
  assert.equal(valueOf(args, "-i"), inputs.listPath);
  assert.equal(valueOf(args, "-f"), "concat");
  assert.equal(valueOf(args, "-safe"), "0");
  assert.equal(valueOf(args, "-stream_loop"), "-1");
  assert.equal(args.filter((arg) => arg === "-re").length, 1);
  assert.deepEqual([valueOf(args, "-g"), valueOf(args, "-sc_threshold"), valueOf(args, "-c:v")], ["60", "0", "libx264"]);
  assert.deepEqual([valuesOf(args, "-f").at(-1), valueOf(args, "-hls_time"), valueOf(args, "-hls_list_size")], ["hls", "2", "6"]);
  assert.equal(args.at(-1), "%v/index.m3u8");
  assert.equal(args.includes("-start_number"), false);
  assert.equal(valueOf(buildEncoderArgs(plain, inputs, 100000), "-start_number"), "100000");
});

test("variants come from the ladder, and audio is its own rendition in the shared group", () => {
  const args = buildEncoderArgs(three, inputs);
  assert.equal(valuesOf(args, "-map").filter((map) => map === "0:v:0").length, 3);
  assert.deepEqual([valueOf(args, "-s:v:2"), valueOf(args, "-b:v:2")], ["1920x1080", "5000k"]);
  assert.deepEqual(renditionNames(three), ["360p", "720p", "1080p", "audio"]);
  const two = buildEncoderArgs(plain, inputs);
  assert.equal(valueOf(two, "-var_stream_map"), "v:0,agroup:aud,name:360p v:1,agroup:aud,name:720p a:0,agroup:aud,language:en,name:audio");
  assert.equal(two.includes("-c:s"), false);
});

test("a captioned channel reads its captions too and carries WebVTT inside the video variants", () => {
  const args = buildEncoderArgs(captioned, inputs);
  assert.deepEqual(valuesOf(args, "-i"), [inputs.listPath, inputs.captionsPath]);
  assert.equal(
    valueOf(args, "-var_stream_map"),
    "v:0,s:0,agroup:aud,sgroup:sub,name:360p v:1,s:1,agroup:aud,sgroup:sub,name:720p a:0,agroup:aud,language:en,name:audio",
  );
  assert.deepEqual(valuesOf(args, "-map"), ["0:v:0", "0:v:0", "0:a:0", "1:s:0", "1:s:0"]);
  assert.throws(() => buildEncoderArgs(captioned, { listPath: inputs.listPath }), /needs its captions file/);
});

test("the loop encode is one video, once, cut to whole segments, into the VOD form of the same ladder", () => {
  const args = buildLoopSourceArgs(captioned, item);
  assert.deepEqual(valuesOf(args, "-i"), [item.path, item.captionsPath]);
  assert.equal(valueOf(args, "-t"), "30", "whole segments, so every rendition has the same count");
  assert.equal(args.includes("-re") || args.includes("-stream_loop"), false);
  assert.equal(valueOf(args, "-hls_playlist_type"), "vod");
  assert.equal(valueOf(args, "-var_stream_map"), valueOf(buildEncoderArgs(captioned, inputs), "-var_stream_map"));
  assert.throws(() => buildLoopSourceArgs(plain, { ...item, durationMs: 1999 }), /shorter than one segment/);
  const { captionsPath: _none, ...bare } = item;
  assert.throws(() => buildLoopSourceArgs(captioned, bare), /has no captions file/);
});

test("captions join in playlist order, each moved to where its video starts and renumbered", () => {
  assert.equal(shiftCaptions("00:00:05,000 --> 00:00:10,500", 30_250), "00:00:35,250 --> 00:00:40,750");
  const one = "1\n00:00:00,000 --> 00:00:05,000\nfirst\n\n2\n00:00:05,000 --> 00:00:10,000\nsecond\n";
  const two = "1\r\n00:00:00,000 --> 00:00:04,000\r\nthird\r\n";
  const joined = joinCaptions([{ text: one, offsetMs: 0 }, { text: two, offsetMs: 3_600_000 }]);
  assert.equal(
    joined,
    "1\n00:00:00,000 --> 00:00:05,000\nfirst\n\n2\n00:00:05,000 --> 00:00:10,000\nsecond\n\n3\n01:00:00,000 --> 01:00:04,000\nthird\n",
  );
});
