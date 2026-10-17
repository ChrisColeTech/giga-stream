import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  continueLabel,
  durationLabel,
  episodeCode,
  identityLine,
  progressRatio,
  remainingLabel,
  seasonsLabel,
  watchLine,
} from "@/lib/library-facts";

describe("durations and progress", () => {
  it("writes a duration in hours and minutes", () => {
    assert.equal(durationLabel(21 * 60_000), "21 min");
    assert.equal(durationLabel(74 * 60_000), "1 h 14 min");
    assert.equal(durationLabel(2 * 3_600_000), "2 h");
  });

  it("reads the watched share and leaves it out without a runtime", () => {
    assert.equal(progressRatio({ positionMs: 250, durationMs: 1000, state: "watching" }), 0.25);
    assert.equal(progressRatio({ positionMs: 5, state: "watching" }), undefined);
    assert.equal(progressRatio({ positionMs: 5000, durationMs: 1000, state: "watching" }), 1);
  });

  it("states the remaining time, or Watched when finished", () => {
    assert.equal(remainingLabel({ positionMs: 0, durationMs: 74 * 60_000, state: "watching" }), "1 h 14 min left");
    assert.equal(remainingLabel({ positionMs: 1, durationMs: 2, state: "watched" }), "Watched");
    assert.equal(remainingLabel({ positionMs: 1, state: "watching" }), undefined);
  });
});

describe("episodes and labels", () => {
  it("writes an episode code with two digits each", () => {
    assert.equal(episodeCode(1, 2), "S01 E02");
    assert.equal(episodeCode(12, 10), "S12 E10");
  });

  it("labels a series in progress by its episode, and a film by its title", () => {
    assert.equal(continueLabel("Breaking Bad", { positionMs: 1, state: "watching", season: 1, episode: 2 }), "Breaking Bad - S01 E02");
    assert.equal(continueLabel("Inception", { positionMs: 1, state: "watching" }), "Inception");
  });

  it("joins the watch line from the episode and the remaining time", () => {
    assert.equal(
      watchLine({ positionMs: 0, durationMs: 60_000, state: "watching", season: 1, episode: 2 }),
      "S01 E02 · 1 min left",
    );
  });
});

describe("identity and seasons", () => {
  it("leaves out a quality that is not a real value", () => {
    assert.equal(identityLine({ year: 1999, kind: "movie" }), "1999 · Movie");
    assert.equal(identityLine({ year: 2025, kind: "local", quality: "1080p" }), "2025 · Local file · 1080p");
  });

  it("counts seasons and episodes in the singular and the plural", () => {
    assert.equal(seasonsLabel([{ season: 1, episodeCount: 1 }]), "1 season · 1 episode");
    assert.equal(
      seasonsLabel([
        { season: 1, episodeCount: 3 },
        { season: 2, episodeCount: 9 },
      ]),
      "2 seasons · 12 episodes",
    );
  });
});
