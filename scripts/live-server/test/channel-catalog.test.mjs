import assert from "node:assert/strict";
import { test } from "node:test";

import { loadCatalog, selectChannels, validateChannels } from "../channel-catalog.mjs";

const valid = (overrides = {}) => ({
  id: "fx-test",
  name: "Fixture Test",
  category: "News",
  number: 9,
  playlist: ["live/test-1.mp4", "live/test-2.mp4"],
  captions: false,
  mode: "loop",
  variants: ["360p", "720p"],
  ...overrides,
});

test("the shipped catalog has the four fixture channels of docs/10 section 3.2, each a playlist of three", () => {
  assert.deepEqual(
    loadCatalog().map((channel) => [channel.id, channel.number, channel.category, channel.playlist]),
    [
      ["fx-news", 1, "News", ["live/news-1.mp4", "live/news-2.mp4", "live/news-3.mp4"]],
      ["fx-sports", 2, "Sports", ["live/sports-1.mp4", "live/sports-2.mp4", "live/sports-3.mp4"]],
      ["fx-music", 3, "Music", ["live/music-1.mp4", "live/music-2.mp4", "live/music-3.mp4"]],
      ["fx-kids", 4, "Kids", ["live/kids-1.mp4", "live/kids-2.mp4", "live/kids-3.mp4"]],
    ],
  );
});

test("only news has captions; sports has three variants", () => {
  const byId = Object.fromEntries(loadCatalog().map((channel) => [channel.id, channel]));
  assert.deepEqual(Object.keys(byId).filter((id) => byId[id].captions), ["fx-news"]);
  assert.equal(byId["fx-sports"].variants.length, 3);
});

test("a valid playlist channel or folder channel passes and is returned as is", () => {
  const list = [valid(), valid({ id: "fx-two", number: 10, playlist: undefined, folder: "D:/videos" })];
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
    [[valid({ playlist: undefined })], /either a playlist or a folder/],
    [[valid({ folder: "D:/videos" })], /either a playlist or a folder/],
    [[valid({ playlist: [] })], /at least one file/],
    [[valid({ playlist: ["../outside.mp4"] })], /must be fixture paths/],
    [[valid({ playlist: ["C:/videos/a.mp4"] })], /must be fixture paths/],
    [[valid({ playlist: ["live/clip.mkv"] })], /ending \.mp4/],
    [[valid({ playlist: undefined, folder: " " })], /folder must be a path/],
    [[valid({ captions: "yes" })], /captions must be a boolean/],
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
