import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

describe("live slice", () => {
  it("stores list interactions independently from the active stream", () => {
    state().setChannels({ items: [], categories: [], revision: 1 });
    state().setChannelQuery("news");
    state().setChannelCategory("News");
    state().selectChannel("news");
    state().playChannel("news", "https://media.test/news.m3u8", true);
    state().setChannels({ items: [], categories: [], revision: 2 });

    assert.equal(state().channelQuery, "news");
    assert.equal(state().channelCategory, "News");
    assert.equal(state().selectedChannelId, "news");
    assert.equal(state().playingChannelId, "news");
    assert.equal(state().playingStreamUrl, "https://media.test/news.m3u8");
    assert.equal(state().channels?.revision, 2);
  });

  it("increments the play serial even when the same row is activated again", () => {
    state().playChannel("news", "https://media.test/news.m3u8", true);
    const first = state().livePlaySerial;
    state().playChannel("news", "https://media.test/news.m3u8", true);
    assert.equal(state().livePlaySerial, first + 1);
    assert.equal(state().livePlayUserInitiated, true);
  });

  it("records ready facts and clears the failure sentence on a later state", () => {
    state().setLiveStage("failed", "The playlist failed.");
    assert.equal(state().liveStreamError, "The playlist failed.");
    state().setLiveStreamFacts({ resolution: "1280 x 720", bitrate: "2500 kb/s" });
    state().setLiveStage("ready");
    assert.equal(state().liveStreamError, null);
    assert.deepEqual(state().liveStreamFacts, { resolution: "1280 x 720", bitrate: "2500 kb/s" });
  });
});
