import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { episodeAdjacency, type SeasonRead } from "@/lib/episode-adjacency";
import {
  EPISODE_LOADING_REASON, EPISODE_READ_FAILURE_REASON, FIRST_EPISODE_REASON, LAST_EPISODE_REASON,
} from "@/lib/player-copy";
import type { Episode } from "@/types/title";

const ready = (...episodes: Episode[]): SeasonRead => ({ kind: "ready", episodes });

describe("episode adjacency", () => {
  it("uses the nearest real same-season neighbors from unsorted nonconsecutive episodes", () => {
    const reads = new Map([[2, ready(
      { season: 2, episode: 9 }, { season: 2, episode: 1 }, { season: 2, episode: 4 },
    )]]);
    const result = episodeAdjacency([{ season: 2, episodeCount: 9 }], reads, { season: 2, episode: 4 });
    assert.deepEqual(result.previous.target, { season: 2, episode: 1 });
    assert.deepEqual(result.next.target, { season: 2, episode: 9 });
  });

  it("requests real boundary seasons in sorted order and never manufactures an episode", () => {
    const summaries = [
      { season: 3, episodeCount: 8 }, { season: 0, episodeCount: 2 },
      { season: 1, episodeCount: 12 }, { season: 2, episodeCount: 0 },
    ];
    const reads = new Map([[1, ready({ season: 1, episode: 6 })]]);
    const pending = episodeAdjacency(summaries, reads, { season: 1, episode: 6 });
    assert.equal(pending.next.readSeason, 3);
    assert.equal(pending.next.reason, EPISODE_LOADING_REASON);
    assert.equal(pending.previous.reason, FIRST_EPISODE_REASON);
    reads.set(3, ready({ season: 3, episode: 7 }, { season: 3, episode: 2 }));
    assert.deepEqual(
      episodeAdjacency(summaries, reads, { season: 1, episode: 6 }).next.target,
      { season: 3, episode: 2 },
    );
  });

  it("skips successful empty seasons and Season 0 in either direction", () => {
    const summaries = [
      { season: 0, episodeCount: 1 }, { season: 1, episodeCount: 2 },
      { season: 2, episodeCount: 4 }, { season: 3, episodeCount: 1 },
    ];
    const reads = new Map<number, SeasonRead>([
      [1, ready({ season: 1, episode: 3 })], [2, ready()], [3, ready({ season: 3, episode: 8 })],
    ]);
    assert.deepEqual(
      episodeAdjacency(summaries, reads, { season: 1, episode: 3 }).next.target,
      { season: 3, episode: 8 },
    );
    assert.deepEqual(
      episodeAdjacency(summaries, reads, { season: 3, episode: 8 }).previous.target,
      { season: 1, episode: 3 },
    );
  });

  it("reports first, last, pending and failed reads with exact reasons", () => {
    const summaries = [{ season: 1, episodeCount: 1 }, { season: 2, episodeCount: 1 }];
    const first = new Map<number, SeasonRead>([[1, ready({ season: 1, episode: 1 })], [2, { kind: "pending" }]]);
    const result = episodeAdjacency(summaries, first, { season: 1, episode: 1 });
    assert.equal(result.previous.reason, FIRST_EPISODE_REASON);
    assert.equal(result.next.reason, EPISODE_LOADING_REASON);
    first.set(2, { kind: "failed" });
    assert.equal(episodeAdjacency(summaries, first, { season: 1, episode: 1 }).next.reason,
      EPISODE_READ_FAILURE_REASON);
    first.set(2, ready({ season: 2, episode: 1 }));
    assert.equal(episodeAdjacency(summaries, first, { season: 2, episode: 1 }).next.reason, LAST_EPISODE_REASON);
  });
});
