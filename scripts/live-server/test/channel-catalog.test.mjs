import assert from "node:assert/strict";
import { test } from "node:test";

import { loadCatalog, selectChannels, validateChannels } from "../channel-catalog.mjs";

const valid = (overrides = {}) => ({
  id: "fx-test",
  name: "Fixture Test",
  category: "News",
  number: 9,
  file: "live/test.mp4",
  captions: false,
  mode: "loop",
  variants: ["360p", "720p"],
  ...overrides,
});

test("the shipped catalog has the four fixture channels of docs/10 section 3.2, each with its own file", () => {
  assert.deepEqual(
    loadCatalog().map((channel) => [channel.id, channel.number, channel.category, channel.file]),
    [
      ["fx-news", 1, "News", "live/news.mp4"],
      ["fx-sports", 2, "Sports", "live/sports.mp4"],
      ["fx-music", 3, "Music", "live/music.mp4"],
      ["fx-kids", 4, "Kids", "live/kids.mp4"],
    ],
  );
});

test("only news has captions, from its caption file; sports has three variants", () => {
  const byId = Object.fromEntries(loadCatalog().map((channel) => [channel.id, channel]));
  assert.deepEqual(Object.keys(byId).filter((id) => byId[id].captions), ["fx-news"]);
  assert.equal(byId["fx-news"].captionsFile, "live/news.en.srt");
  assert.equal(byId["fx-sports"].variants.length, 3);
});

test("a valid channel passes and is returned as is", () => {
  const list = [valid()];
  assert.equal(validateChannels(list), list);
});

test("each kind of bad channel is refused with an explicit error naming it", () => {
  const cases = [
    [[valid({ id: "Bad Id" })], /id must be kebab-case/],
    [[valid(), valid({ number: 10 })], /fx-test: id is duplicated/],
    [[valid(), valid({ id: "fx-two" })], /number 9 is duplicated/],
    [[valid({ name: "  " })], /name must be a non-empty string/],
    [[valid({ number: 0 })], /number must be a positive integer/],
    [[valid({ category: "Weather" })], /category must be one of/],
    [[valid({ mode: "stream" })], /mode must be one of encode, loop/],
    [[valid({ file: "../outside.mp4" })], /file must be a fixture path/],
    [[valid({ file: "C:/videos/a.mp4" })], /file must be a fixture path/],
    [[valid({ file: "live/clip.mkv" })], /ending \.mp4/],
    [[valid({ captions: "yes" })], /captions must be a boolean/],
    [[valid({ captions: true })], /needs a captionsFile/],
    [[valid({ captionsFile: "live/x.srt" })], /only for a captioned channel/],
    [[valid({ variants: ["720p"] })], /at least two renditions/],
    [[valid({ variants: ["360p", "4k"] })], /from the ladder/],
    [[valid({ variants: ["360p", "360p"] })], /unique/],
    [[], /non-empty array/],
    [[null], /entry 0: is not an object/],
  ];
  for (const [list, pattern] of cases) assert.throws(() => validateChannels(list), pattern);
});

test("selectChannels returns all by default, the requested ones in order, and refuses unknown ids", () => {
  const catalog = loadCatalog();
  assert.equal(selectChannels(catalog), catalog);
  assert.deepEqual(selectChannels(catalog, ["fx-kids", "fx-news"]).map((channel) => channel.id), ["fx-kids", "fx-news"]);
  assert.throws(() => selectChannels(catalog, ["fx-nope"]), /unknown channel "fx-nope"/);
});

test("a missing catalog file is an explicit error", () => {
  assert.throws(() => loadCatalog("does-not-exist.json"), /cannot read/);
});
