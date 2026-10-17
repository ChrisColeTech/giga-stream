import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatClock, formatEpisodeCode, formatRuntime, parseEpisodeCode, progressFraction } from "@/lib/player-format";
import { episodeMarker, stageSubtitle, type PlayerView } from "@/lib/player-view";

describe("clocks and runtimes", () => {
  it("a clock is minutes and seconds, with an hour only from an hour", () => {
    assert.equal(formatClock(1_260_000), "21:00");
    assert.equal(formatClock(0), "0:00");
    assert.equal(formatClock(4_861_000), "1:21:01");
  });

  it("a runtime is hours and minutes, or minutes under an hour", () => {
    assert.equal(formatRuntime(8_160_000), "2h 16m");
    assert.equal(formatRuntime(2_820_000), "47m");
  });
});

describe("episode codes", () => {
  it("formats the season and episode with two digits", () => {
    assert.equal(formatEpisodeCode(1, 2), "S01 E02");
    assert.equal(formatEpisodeCode(12, 10), "S12 E10");
  });

  it("reads a code back, and reads nothing else", () => {
    assert.deepEqual(parseEpisodeCode("S01 E02"), { season: 1, episode: 2 });
    assert.equal(parseEpisodeCode("Episode 2"), undefined);
    assert.equal(parseEpisodeCode(undefined), undefined);
  });
});

describe("progress", () => {
  it("is a fraction clamped to 0 to 1, and absent without a duration", () => {
    assert.equal(progressFraction(1_260_000, 2_820_000), 1_260_000 / 2_820_000);
    assert.equal(progressFraction(5, 0), undefined);
    assert.equal(progressFraction(3_000_000, 2_000_000), 1);
  });

  it("only the exact episode carries a marker", () => {
    const progress = { positionMs: 1_260_000, durationMs: 2_820_000, state: "watching" as const, season: 1, episode: 2 };
    assert.equal(episodeMarker(progress, 1, 1), undefined);
    assert.deepEqual(episodeMarker(progress, 1, 2), { watched: false, fraction: 1_260_000 / 2_820_000 });
    assert.deepEqual(episodeMarker({ ...progress, state: "watched" }, 1, 2), { watched: true });
  });
});

describe("the stage subtitle", () => {
  const base: PlayerView = {
    tab: undefined,
    item: undefined,
    detail: undefined,
    stage: { kind: "idle" },
    favorite: false,
    memberIds: [],
    collections: [],
    season: 1,
    episode: 2,
    seasons: [],
    episodes: [{ season: 1, episode: 2, title: "Cat's in the Bag..." }],
    related: [],
  };

  it("names the exact episode and its title for a series", () => {
    const view: PlayerView = {
      ...base,
      tab: { id: "t", ref: { kind: "title", id: "tv-1" }, kind: "tv", title: "Show", subtitle: "S01 E02" },
    };
    assert.equal(stageSubtitle(view), "S01 E02 · Cat's in the Bag...");
  });

  it("names a local file by its kind and draws nothing without a tab", () => {
    const view: PlayerView = { ...base, tab: { id: "l", ref: { kind: "local", id: "local-1" }, kind: "local", title: "Clip" } };
    assert.equal(stageSubtitle(view), "Local file");
    assert.equal(stageSubtitle(base), undefined);
  });
});
