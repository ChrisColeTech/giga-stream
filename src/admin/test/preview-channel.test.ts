import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { previewChannel } from "@/lib/channel-list";
import { queryKey } from "@/lib/channel-query";
import { PLAYER_IDLE, previewLine } from "@/lib/preview-state";
import { useAppStore } from "@/store/app-store";
import { stream } from "./support/channels-kit";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const channel = (id: string) => previewChannel(state().channels, id);

/** A long list: the first page of `total` rows is held, as a windowed list leaves it. */
function holdPage(ids: readonly string[], total: number): void {
  const key = queryKey(state().channels.query);
  state().channelsPageLoaded(key, 0, ids.map((id) => stream(id)), total, 1);
}

beforeEach(() => {
  resetStore();
});

describe("the Preview window's channel", () => {
  it("survives the window's own read: a long list drops its pages and re-reads only the rows it shows", () => {
    holdPage(["a", "b"], 500);
    state().channelsOpenPreview("a");
    state().channelsInvalidate(); // what the window's open does through `flows.refresh`
    assert.deepEqual(state().channels.items, []);
    assert.equal(channel("a")?.id, "a", "the row Preview was pressed on stands in until the pages are back");
    assert.equal(previewLine(channel("a"), false, PLAYER_IDLE).notice, undefined, "no stale 'does not exist' notice");
  });

  it("gives the stand-in only to the channel Preview was pressed on", () => {
    holdPage(["a", "b"], 500);
    state().channelsOpenPreview("a");
    state().channelsInvalidate();
    assert.equal(channel("b"), undefined);
  });

  it("trusts a fully loaded list: a channel missing from it is gone", () => {
    holdPage(["a", "b"], 2);
    state().channelsOpenPreview("a");
    state().channelRemove("a");
    assert.equal(channel("a"), undefined);
    assert.ok(previewLine(channel("a"), false, PLAYER_IDLE).notice?.includes("does not exist"));
  });

  it("prefers the list's fresh copy over the stand-in", () => {
    holdPage(["a"], 500);
    state().channelsOpenPreview("a");
    state().channelUpsert({ ...stream("a"), name: "Renamed" });
    assert.equal(channel("a")?.name, "Renamed");
  });
});
