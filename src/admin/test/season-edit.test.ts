import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addEpisode,
  addSeason,
  hasRepeatedSeason,
  moveSeason,
  removeEpisode,
  removeSeason,
  setEpisode,
  setSeasonNumber,
  type SeasonDraft,
} from "@/lib/season-edit";

const two: SeasonDraft[] = [
  { season: 1, episodes: [{ episode: 1, title: "Pilot", rest: { airDate: "2020-01-01" } }] },
  { season: 2, episodes: [] },
];
const numbers = (seasons: readonly SeasonDraft[]): number[] => seasons.map((one) => one.season);

describe("season edits", () => {
  it("adds a season with the next free number", () => {
    assert.deepEqual(numbers(addSeason([])), [1]);
    assert.deepEqual(numbers(addSeason(two)), [1, 2, 3]);
  });

  it("removes and reorders, staying put at an end", () => {
    assert.deepEqual(numbers(removeSeason(two, 0)), [2]);
    assert.deepEqual(numbers(moveSeason(two, 1, -1)), [2, 1]);
    assert.deepEqual(numbers(moveSeason(two, 0, -1)), [1, 2]);
    assert.deepEqual(numbers(moveSeason(two, 1, 1)), [1, 2]);
  });

  it("renumbers a season and finds a number used twice", () => {
    const same = setSeasonNumber(two, 1, 1);
    assert.deepEqual(numbers(same), [1, 1]);
    assert.ok(hasRepeatedSeason(same) && !hasRepeatedSeason(two));
  });

  it("adds, edits and removes episodes, keeping the fields the editor does not show", () => {
    const added = addEpisode(two, 0);
    assert.deepEqual(added[0]?.episodes.map((e) => e.episode), [1, 2]);
    const named = setEpisode(added, 0, 0, { title: "Opening" });
    const first = named[0]?.episodes[0];
    assert.deepEqual([first?.title, first?.rest], ["Opening", { airDate: "2020-01-01" }]);
    assert.deepEqual(removeEpisode(named, 0, 0)[0]?.episodes.map((e) => e.episode), [2]);
    assert.equal(two[0]?.episodes.length, 1, "the input is never changed");
  });
});
