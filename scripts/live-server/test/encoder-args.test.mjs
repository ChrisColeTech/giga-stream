import assert from "node:assert/strict";
import { test } from "node:test";

import { loadCatalog } from "../channel-catalog.mjs";
import { buildEncoderArgs, renditionNames } from "../encoder-args.mjs";
import { buildLoopSourceArgs } from "../loop-source-args.mjs";

const byId = Object.fromEntries(loadCatalog().map((channel) => [channel.id, channel]));
const fixtureOf = (id) => ({
  path: `C:/fixtures/${id}.mp4`,
  ...(byId[id].captions && { captionsPath: `C:/fixtures/${id}.srt` }),
});

const argsFor = (id) => buildEncoderArgs(byId[id], fixtureOf(id));
/** Every value that follows `flag`, in order (a flag may repeat). */
const valuesOf = (args, flag) => args.flatMap((arg, index) => (arg === flag ? [args[index + 1]] : []));
const valueOf = (args, flag) => valuesOf(args, flag)[0];

test("encode mode reads the fixture file in real time and loops it forever, into 2 s segments and a 6-segment window", () => {
  for (const id of Object.keys(byId)) {
    const args = argsFor(id);
    assert.equal(valueOf(args, "-i"), fixtureOf(id).path, id);
    assert.equal(valueOf(args, "-stream_loop"), "-1", id);
    assert.equal(args.filter((arg) => arg === "-re").length, id === "fx-news" ? 2 : 1, id);
    assert.equal(args.includes("lavfi"), false, `${id} reads a file, not a generator`);
    assert.equal(valueOf(args, "-g"), "60");
    assert.equal(valueOf(args, "-sc_threshold"), "0");
    assert.equal(valueOf(args, "-c:v"), "libx264");
    assert.equal(valueOf(args, "-c:a"), "aac");
    assert.equal(valuesOf(args, "-f").at(-1), "hls");
    assert.equal(valueOf(args, "-hls_time"), "2");
    assert.equal(valueOf(args, "-hls_list_size"), "6");
    assert.equal(valueOf(args, "-hls_flags"), "delete_segments+program_date_time+independent_segments");
    assert.equal(valueOf(args, "-master_pl_name"), "master.m3u8");
    assert.equal(args.at(-1), "%v/index.m3u8");
  }
});

test("variants: two for most channels, three for sports, each with its size and bitrate", () => {
  const news = argsFor("fx-news");
  assert.equal(valuesOf(news, "-map").filter((map) => map === "0:v:0").length, 2);
  assert.deepEqual([valueOf(news, "-s:v:0"), valueOf(news, "-b:v:0")], ["640x360", "800k"]);
  assert.deepEqual([valueOf(news, "-s:v:1"), valueOf(news, "-b:v:1")], ["1280x720", "2500k"]);
  const sports = argsFor("fx-sports");
  assert.equal(valuesOf(sports, "-map").filter((map) => map === "0:v:0").length, 3);
  assert.deepEqual([valueOf(sports, "-s:v:2"), valueOf(sports, "-b:v:2")], ["1920x1080", "5000k"]);
  assert.deepEqual(renditionNames(byId["fx-sports"]), ["360p", "720p", "1080p", "audio"]);
});

test("the file's audio is its own rendition in the shared group", () => {
  const args = argsFor("fx-music");
  assert.equal(valueOf(args, "-var_stream_map"), "v:0,agroup:aud,name:360p v:1,agroup:aud,name:720p a:0,agroup:aud,language:en,name:audio");
  assert.deepEqual(valuesOf(args, "-map"), ["0:v:0", "0:v:0", "0:a:0"]);
});

test("a captioned channel adds its caption file and maps WebVTT inside the video variants", () => {
  const args = argsFor("fx-news");
  assert.deepEqual(valuesOf(args, "-i"), [fixtureOf("fx-news").path, fixtureOf("fx-news").captionsPath]);
  assert.equal(
    valueOf(args, "-var_stream_map"),
    "v:0,s:0,agroup:aud,sgroup:sub,name:360p v:1,s:1,agroup:aud,sgroup:sub,name:720p a:0,agroup:aud,language:en,name:audio",
  );
  assert.deepEqual(valuesOf(args, "-map"), ["0:v:0", "0:v:0", "0:a:0", "1:s:0", "1:s:0"]);
  assert.equal(valueOf(args, "-c:s"), "webvtt");
});

test("a channel without its fixture, or a captioned one without its captions, is refused", () => {
  assert.throws(() => buildEncoderArgs(byId["fx-kids"], undefined), /needs its fixture file/);
  assert.throws(() => buildEncoderArgs(byId["fx-news"], { path: "C:/a.mp4" }), /needs its captions file/);
  assert.throws(() => buildLoopSourceArgs(byId["fx-news"], { path: "C:/a.mp4" }), /needs its captions file/);
  const plain = argsFor("fx-kids");
  assert.equal(plain.includes("-c:s"), false);
});

test("start number is added only after a restart", () => {
  assert.equal(argsFor("fx-news").includes("-start_number"), false);
  assert.equal(valueOf(buildEncoderArgs(byId["fx-kids"], fixtureOf("fx-kids"), { startNumber: 100000 }), "-start_number"), "100000");
});

test("the loop source encodes the whole fixture file once into the VOD form of the same variants", () => {
  const news = buildLoopSourceArgs(byId["fx-news"], fixtureOf("fx-news"));
  assert.equal(valueOf(news, "-i"), fixtureOf("fx-news").path);
  assert.equal(news.includes("-t"), false, "the whole file, not a cut");
  assert.equal(news.includes("-re"), false);
  assert.equal(news.includes("-stream_loop"), false);
  assert.equal(valueOf(news, "-hls_playlist_type"), "vod");
  assert.equal(valueOf(news, "-hls_time"), "2");
  assert.equal(valueOf(news, "-var_stream_map"), valueOf(argsFor("fx-news"), "-var_stream_map"));
});
