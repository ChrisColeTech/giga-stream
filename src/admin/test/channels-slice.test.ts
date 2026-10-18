import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { preparingCount, selectAllState } from "@/lib/channel-list";
import { NO_CHANNELS } from "@/store/channels-slice";
import { useAppStore } from "@/store/app-store";
import { live, stream } from "./support/channels-kit";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();

beforeEach(() => {
  resetStore();
});

describe("the channels slice", () => {
  it("starts idle and empty, loads, fails keeping the last rows, and clears unreachable on the next read", () => {
    assert.deepEqual(state().channels, NO_CHANNELS);
    state().channelsStartLoad();
    assert.equal(state().channels.status, "loading");
    state().channelsLoaded([live("a"), stream("b")], 4);
    assert.deepEqual([state().channels.status, state().channels.items.length, state().channels.revision], ["ready", 2, 4]);
    state().channelsLoadFailed(true);
    assert.deepEqual([state().channels.status, state().channels.items.length, state().channels.unreachable], ["failed", 2, true]);
    state().channelsLoaded([live("a")], 5);
    assert.equal(state().channels.unreachable, false);
  });

  it("replaces a channel by id on upsert, adds a new one, and removes one", () => {
    state().channelsLoaded([live("a"), stream("b")], 1);
    state().channelUpsert(live("a", { name: "Renamed", state: "preparing" }));
    state().channelUpsert(stream("c"));
    assert.deepEqual(state().channels.items.map((item) => [item.id, item.name]), [
      ["a", "Renamed"],
      ["b", "Stream b"],
      ["c", "Stream c"],
    ]);
    state().channelRemove("b");
    assert.deepEqual(state().channels.items.map((item) => item.id), ["a", "c"]);
  });

  it("ticks rows, ticks all, reads mixed over a part, and prunes a tick with its row", () => {
    state().channelsLoaded([live("a"), stream("b"), live("c")], 1);
    state().channelTick("a", true);
    assert.equal(selectAllState(state().channels.items, state().channels.ticked), "mixed");
    state().channelsTickAll(true);
    assert.equal(selectAllState(state().channels.items, state().channels.ticked), true);
    state().channelRemove("b");
    assert.deepEqual(state().channels.ticked, ["a", "c"]);
    state().channelsLoaded([live("c")], 2);
    assert.deepEqual(state().channels.ticked, ["c"]);
    state().channelsSetTicked(["c", "gone"]);
    assert.deepEqual(state().channels.ticked, ["c"]);
    state().channelsTickAll(false);
    assert.deepEqual(state().channels.ticked, []);
  });

  it("holds the Preview's request value with a raised serial, and closes it", () => {
    state().channelsOpenPreview("a");
    const first = state().channels.preview;
    state().channelsOpenPreview("b");
    assert.deepEqual([first?.channelId, state().channels.preview?.channelId], ["a", "b"]);
    assert.ok((state().channels.preview?.serial ?? 0) > (first?.serial ?? 0));
    state().channelsClosePreview();
    assert.equal(state().channels.preview, null);
  });

  it("resets to the start", () => {
    state().channelsLoaded([live("a")], 3);
    state().channelTick("a", true);
    state().channelsReset();
    assert.deepEqual(state().channels, NO_CHANNELS);
  });
});

describe("the statusbar's preparing count", () => {
  it("counts enabled live rows preparing, starting or restarting, never a stream or a disabled row", () => {
    const items = [
      live("a", { state: "preparing" }),
      live("b", { state: "starting" }),
      live("c", { state: "restarting" }),
      live("d", { state: "live" }),
      live("e", { state: "failed" }),
      live("f", { state: "preparing", enabled: false }),
      stream("g"),
    ];
    assert.equal(preparingCount(items), 3);
    assert.equal(preparingCount([]), 0);
  });
});
