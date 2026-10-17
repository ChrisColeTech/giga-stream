import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { episodeDuringRefresh, playerDataRequestKey } from "@/lib/player-data-refresh";
import type { Episode } from "@/types/title";

describe("Player data retry", () => {
  it("changes exact season and episode request generations when Retry increments", () => {
    assert.notEqual(
      playerDataRequestKey("title:tv-1", "2:4", 0),
      playerDataRequestKey("title:tv-1", "2:4", 1),
    );
  });

  it("keeps the playing episode during its retry but clears it for a different exact episode", () => {
    const episode: Episode = { season: 2, episode: 4, title: "Four" };
    assert.equal(episodeDuringRefresh("2:4", "2:4", episode), episode);
    assert.equal(episodeDuringRefresh("2:4", "3:1", episode), undefined);
  });
});
