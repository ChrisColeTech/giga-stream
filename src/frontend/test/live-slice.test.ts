import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { channelListUnavailable } from "@/lib/live-stage";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

describe("live slice", () => {
  it("keeps a hydrated disconnected empty list unresolved for skeleton rendering", () => {
    state().applySnapshot({
      backend: { url: "configured", connected: false, error: { code: "backend.unreachable", message: "Down." } },
      channels: { items: [], categories: [], revision: 0 },
      unreadable: [],
    });
    assert.equal(state().channels?.items.length, 0);
    assert.equal(state().channelsResolved, false);
    assert.equal(channelListUnavailable(state().backend, state().channelsResolved), true);
  });

  it("clears a missing list selection without interrupting the active stream", () => {
    const channel = {
      id: "news",
      name: "News",
      category: "News",
      revision: 1,
      streamUrl: "https://media.test/news.m3u8",
    };
    state().setChannels({ items: [channel], categories: [{ value: "News", count: 1 }], revision: 1 });
    state().setChannelQuery("news");
    state().setChannelCategory("News");
    state().selectChannel("news");
    state().playChannel(channel.id, channel.streamUrl, true);
    assert.equal(state().playingChannelId, "news");
    state().setChannels({ items: [], categories: [], revision: 2 });

    assert.equal(state().channelQuery, "news");
    assert.equal(state().channelCategory, "News");
    assert.equal(state().selectedChannelId, null);
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
