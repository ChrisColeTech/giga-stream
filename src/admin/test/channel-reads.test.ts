import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { heldTicked } from "@/lib/channel-list";
import { planChannelBulk } from "@/lib/channel-bulk";
import { DEFAULT_CHANNEL_QUERY, queryKey, withFilter, withSearch, type ChannelQuery } from "@/lib/channel-query";
import { createChannelReads, SELECT_MATCHING_MAX } from "@/services/channel-reads";
import type { ChannelsService } from "@/services/channels";
import type { ChannelPage } from "@/services/schemas/channel-schema";
import { useAppStore } from "@/store/app-store";
import type { AdminChannel } from "@/types/admin-channel";
import { live, stream } from "./support/channels-kit";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const row = (n: number): AdminChannel => stream(`c${String(n).padStart(5, "0")}`);
const slice = (from: number, count: number, total: number): ChannelPage => ({
  items: Array.from({ length: Math.max(0, Math.min(count, total - from)) }, (_, i) => row(from + i)),
  revision: 5,
  total,
  offset: from,
  unreadable: 0,
});

interface Fake {
  readonly service: ChannelsService;
  readonly asked: { query: ChannelQuery; index: number; limit: number | undefined }[];
}

/** A service that answers pages of a `total`-row list, and records what it was asked. */
function fake(total: number, over: Partial<ChannelsService> = {}): Fake {
  const asked: Fake["asked"] = [];
  const nope = async (): Promise<never> => {
    throw new Error("unexpected call");
  };
  const service: ChannelsService = {
    list: nope, create: nope, update: nope, remove: nope, rebuild: nope, revert: nope, setEnabled: nope, setStatus: nope, readOne: nope,
    page: async (query, index, limit = 100) => {
      asked.push({ query, index, limit });
      return slice(index * limit, limit, total);
    },
    liveRows: async () => ({ items: [live("l1", { state: "preparing" })], revision: 5, total: 1, offset: 0, unreadable: 0 }),
    ...over,
  };
  return { service, asked };
}
const readsOf = (service: ChannelsService) => createChannelReads({ service, store: () => state() });

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the channel reads", () => {
  it("load reads page 0 and the live rows once, and does nothing while a read runs", async () => {
    const { service, asked } = fake(250);
    const reads = readsOf(service);
    await reads.load();
    assert.deepEqual(asked.map((one) => one.index), [0]);
    assert.deepEqual([state().channels.total, state().channels.items.length, state().channels.live.map((c) => c.id)], [250, 100, ["l1"]]);
    state().channelsStartLoad();
    await reads.load();
    assert.equal(asked.length, 1);
  });

  it("appends the pages the window asks for, by offset", async () => {
    const { service, asked } = fake(250);
    const reads = readsOf(service);
    await reads.load();
    await reads.readPage(2);
    assert.deepEqual(asked.map((one) => one.index), [0, 2]);
    assert.deepEqual(Object.keys(state().channels.pages), ["0", "2"]);
    assert.equal(state().channels.items.at(-1)?.id, "c00249");
  });

  it("a new query drops every page, reads its first page with the query, and ignores a repeat", async () => {
    const { service, asked } = fake(250);
    const reads = readsOf(service);
    await reads.load();
    const next = withFilter(withSearch(DEFAULT_CHANNEL_QUERY, "news"), "kind", "stream");
    await reads.setQuery(next);
    assert.deepEqual([asked.at(-1)?.query, asked.at(-1)?.index], [next, 0]);
    assert.deepEqual(Object.keys(state().channels.pages), ["0"]);
    await reads.setQuery(next);
    assert.equal(asked.length, 2);
  });

  it("throws away a page that answers for a query that is no longer the held one", async () => {
    let release: (page: ChannelPage) => void = () => undefined;
    const { service } = fake(250, {
      page: (query) => (query.q === "" ? new Promise((resolve) => (release = resolve)) : Promise.resolve(slice(0, 5, 5))),
    });
    const reads = readsOf(service);
    const slow = reads.readPage(0);
    await reads.setQuery(withSearch(DEFAULT_CHANNEL_QUERY, "x"));
    release(slice(0, 100, 250));
    await slow;
    assert.deepEqual([state().channels.total, state().channels.items.length, queryKey(state().channels.query)], [5, 5, queryKey(withSearch(DEFAULT_CHANNEL_QUERY, "x"))]);
  });

  it("Refresh of a short list reads its first page again; of a long one it drops the pages and leaves the window to ask", async () => {
    const small = fake(40);
    await readsOf(small.service).load();
    await readsOf(small.service).refresh();
    assert.deepEqual(small.asked.map((one) => one.index), [0, 0]);
    resetStore();
    signInForTest();
    const big = fake(5000);
    const reads = readsOf(big.service);
    await reads.load();
    await reads.refresh();
    assert.equal(big.asked.length, 1, "no page read: the window asks for the pages it shows");
    assert.deepEqual([state().channels.items.length, state().channels.total], [0, 5000]);
  });

  it("marks the backend unreachable on a transport failure and keeps the rows it has", async () => {
    let up = true;
    const { service } = fake(3, {
      page: async () => (up ? slice(0, 3, 3) : Promise.reject(new ApiError("backend.unreachable", "Down.", 0, {}))),
    });
    const reads = readsOf(service);
    await reads.load();
    up = false;
    await reads.readPage(0);
    assert.deepEqual([state().channels.status, state().channels.unreachable, state().channels.items.length], ["failed", true, 3]);
  });

  it("drops an answer that arrives after the session changed", async () => {
    let release: (page: ChannelPage) => void = () => undefined;
    const { service } = fake(3, { page: () => new Promise((resolve) => (release = resolve)) });
    const pending = readsOf(service).readPage(0);
    useAppStore.setState({ serial: state().serial + 1 });
    release(slice(0, 3, 3));
    assert.deepEqual(await pending, { ok: false, sentence: "", dropped: true });
    assert.deepEqual(state().channels.items, []);
  });
});

describe("selection across pages and bulk resolve", () => {
  it("Select all M matching reads 200 rows at a time, in order, and ticks every one whole", async () => {
    const { service, asked } = fake(450);
    const reads = readsOf(service);
    await reads.load();
    await reads.selectMatching();
    assert.deepEqual(asked.slice(1).map((one) => [one.index, one.limit]), [[0, 200], [1, 200], [2, 200]]);
    assert.equal(state().channels.ticked.length, 450);
    assert.equal(state().channels.resolving, false);
    assert.equal(state().channels.ticked[449], "c00449");
  });

  it("ticks only the first SELECT_MATCHING_MAX of a larger match and says so", async () => {
    const { service, asked } = fake(SELECT_MATCHING_MAX + 500);
    const reads = readsOf(service);
    await reads.load();
    await reads.selectMatching();
    assert.equal(asked.length - 1, SELECT_MATCHING_MAX / 200);
    assert.equal(state().channels.ticked.length, SELECT_MATCHING_MAX);
    assert.equal(state().notice?.sentence, "Selected the first 10,000 of 10,500 matching channels.");
  });

  it("stops without ticking when the query changes while it reads", async () => {
    const { service } = fake(450, {
      page: async (query, index, limit = 100) => {
        if (query.q === "" && limit === 200 && index === 1) await readsOf(fake(1).service).setQuery(withSearch(DEFAULT_CHANNEL_QUERY, "x"));
        return slice(index * limit, limit, 450);
      },
    });
    const reads = readsOf(service);
    await reads.load();
    await reads.selectMatching();
    assert.deepEqual([state().channels.ticked.length, state().channels.resolving], [0, false]);
  });

  it("ticks across pages: rows ticked on page 0, then page 2, are all held whole after the pages are dropped", async () => {
    const { service } = fake(250);
    const reads = readsOf(service);
    await reads.load();
    await reads.readPage(2);
    state().channelTick("c00001", true);
    state().channelTick("c00240", true);
    state().channelsInvalidate();
    const rows = heldTicked(state().channels.held, state().channels.ticked);
    assert.deepEqual(rows.map((one) => one.id), ["c00001", "c00240"]);
    assert.deepEqual(planChannelBulk("delete", rows, state().channels.ticked).runnable.map((one) => one.id), ["c00001", "c00240"]);
  });

  it("plans a verb over the held rows and skips a ticked id it holds no row for, with the reason", () => {
    const plan = planChannelBulk("delete", [row(1)], ["c00001", "gone"]);
    assert.deepEqual(plan.runnable.map((one) => one.id), ["c00001"]);
    assert.deepEqual(plan.refused.map((one) => [one.id, one.reason]), [["gone", "Not loaded."]]);
  });
});
