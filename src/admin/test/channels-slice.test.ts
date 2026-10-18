import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { channelById, heldTicked, preparingCount } from "@/lib/channel-list";
import { DEFAULT_CHANNEL_QUERY, queryKey, withSearch } from "@/lib/channel-query";
import { NO_CHANNELS } from "@/store/channels-slice";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { holdChannels } from "./support/channels-hold";
import { live, stream } from "./support/channels-kit";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const KEY = () => queryKey(state().channels.query);
const rows = (from: number, count: number): AdminChannel[] =>
  Array.from({ length: count }, (_, i) => stream(`c${String(from + i).padStart(4, "0")}`));
const ids = () => state().channels.items.map((item) => item.id);

beforeEach(() => {
  resetStore();
});

describe("the channels slice: one read, a failure, a write", () => {
  it("starts idle and empty, loads, fails keeping the last rows, and clears unreachable on the next read", () => {
    assert.deepEqual(state().channels, NO_CHANNELS);
    state().channelsStartLoad();
    assert.equal(state().channels.status, "loading");
    holdChannels([live("a"), stream("b")], 4);
    assert.deepEqual(
      [state().channels.status, state().channels.items.length, state().channels.revision, state().channels.total],
      ["ready", 2, 4, 2],
    );
    state().channelsLoadFailed(true);
    assert.deepEqual([state().channels.status, state().channels.items.length, state().channels.unreachable], ["failed", 2, true]);
    holdChannels([live("a")], 5);
    assert.equal(state().channels.unreachable, false);
  });

  it("replaces a channel by id on upsert, counts a new one in the total, and removes one", () => {
    holdChannels([live("a"), stream("b")], 1);
    state().channelUpsert(live("a", { name: "Renamed", state: "preparing" }));
    assert.deepEqual(state().channels.items.map((item) => [item.id, item.name]), [["a", "Renamed"], ["b", "Stream b"]]);
    assert.equal(state().channels.total, 2);
    state().channelUpsert(stream("c"));
    assert.deepEqual([state().channels.total, ids()], [3, []], "a new row has no known place: the pages are dropped");
    holdChannels([stream("b"), stream("c")], 2);
    state().channelRemove("b");
    assert.deepEqual([ids(), state().channels.total], [["c"], 1]);
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
    holdChannels([live("a")], 3);
    state().channelTick("a", true);
    state().channelsReset();
    assert.deepEqual(state().channels, NO_CHANNELS);
  });
});

describe("the paged slice", () => {
  it("appends pages by index in list order and keeps the total from the last answer", () => {
    state().channelsPageLoaded(KEY(), 1, rows(100, 100), 250, 7);
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    assert.deepEqual([state().channels.items.length, ids()[0], ids()[199], state().channels.total], [200, "c0000", "c0199", 250]);
    assert.deepEqual(Object.keys(state().channels.pages), ["0", "1"]);
  });

  it("drops the pages read at another revision: the set changed under them", () => {
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    state().channelsPageLoaded(KEY(), 2, rows(200, 50), 250, 8);
    assert.deepEqual(Object.keys(state().channels.pages), ["2"]);
    assert.equal(state().channels.pagesVersion, 8);
  });

  it("resets on a query change: pages and total forgotten, ticks kept, and an old answer dropped", () => {
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    state().channelTick("c0003", true);
    const old = KEY();
    state().channelsSetQuery(withSearch(DEFAULT_CHANNEL_QUERY, "news"));
    assert.deepEqual([state().channels.items, state().channels.total, state().channels.status], [[], null, "loading"]);
    assert.deepEqual(state().channels.ticked, ["c0003"]);
    state().channelsPageLoaded(old, 1, rows(100, 100), 250, 7);
    assert.deepEqual([state().channels.items, state().channels.total], [[], null], "an answer for the old query is thrown away");
    state().channelsPageLoaded(KEY(), 0, rows(0, 3), 3, 7);
    assert.deepEqual([ids().length, state().channels.total], [3, 3]);
  });

  it("invalidates for a refresh: the pages go, the total and the place stay, then a read refills", () => {
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    state().channelsInvalidate();
    assert.deepEqual([state().channels.items, state().channels.total, state().channels.status], [[], 250, "ready"]);
    state().channelsPageLoaded(KEY(), 1, rows(100, 100), 251, 9);
    assert.deepEqual([ids()[0], state().channels.total, state().channels.revision], ["c0100", 251, 9]);
  });

  it("keeps at most 30 pages, farthest from the last one read dropped", () => {
    for (let page = 0; page < 33; page += 1) state().channelsPageLoaded(KEY(), page, rows(page * 100, 100), 9000, 7);
    const kept = Object.keys(state().channels.pages).map(Number);
    assert.equal(kept.length, 30);
    assert.ok(kept.includes(32) && !kept.includes(0));
  });

  it("patches the live rows into the pages, the ticked rows and the opened row", () => {
    state().channelsPageLoaded(KEY(), 0, [live("a", { state: "preparing" }), stream("b")], 2, 1);
    state().channelTick("a", true);
    state().channelRemember(live("a", { state: "preparing" }));
    state().channelsLiveLoaded([live("a", { state: "live" })]);
    const engine = (row: AdminChannel | null | undefined): string | undefined => (row?.kind === "live" ? row.state : undefined);
    assert.deepEqual([engine(state().channels.items[0]), engine(state().channels.held["a"]), engine(state().channels.opened)], ["live", "live", "live"]);
    assert.equal(preparingCount(state().channels.live), 0);
  });
});

describe("selection across pages", () => {
  it("ticks survive their page being dropped: the row is held whole, a workspace still finds it", () => {
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    state().channelTick("c0005", true);
    state().channelsInvalidate();
    assert.deepEqual([state().channels.ticked, heldTicked(state().channels.held, state().channels.ticked).map((r) => r.id)], [["c0005"], ["c0005"]]);
    assert.equal(channelById(state().channels, "c0005")?.id, "c0005");
    state().channelTick("c0005", false);
    assert.deepEqual([state().channels.ticked, state().channels.held], [[], {}]);
  });

  it("`All` ticks the rows loaded and keeps ticks held elsewhere; off clears every tick", () => {
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    state().channelTick("c0001", true);
    state().channelsInvalidate();
    state().channelsPageLoaded(KEY(), 2, rows(200, 50), 250, 7);
    state().channelsTickAll(true);
    assert.equal(state().channels.ticked.length, 51);
    state().channelsTickAll(false);
    assert.deepEqual(state().channels.ticked, []);
  });

  it("ticks whole rows (select all matching), without doubling a tick, and the removal leaves the selection", () => {
    state().channelsPageLoaded(KEY(), 0, rows(0, 100), 250, 7);
    state().channelTick("c0002", true);
    state().channelsTickRows(rows(0, 250));
    assert.equal(state().channels.ticked.length, 250);
    assert.equal(Object.keys(state().channels.held).length, 250);
    state().channelRemove("c0002");
    assert.deepEqual([state().channels.ticked.length, state().channels.total], [249, 249]);
    state().channelsSetTicked(["c0001", "c0200"]);
    assert.deepEqual([state().channels.ticked, Object.keys(state().channels.held).sort()], [["c0001", "c0200"], ["c0001", "c0200"]]);
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
