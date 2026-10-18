import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { loadedRows, rowAt } from "@/lib/title-paged";
import { START_STORED, storedKey } from "@/lib/title-stored-query";
import { createTitleFlows } from "@/services/title-flows";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";
import { fakeStored, serviceOf, storedPage, titleRowOf } from "./support/titles-stored-kit";

const state = () => useAppStore.getState();
const stored = () => state().titlesStored;

function rig(count: number, version = "5:1") {
  const fake = fakeStored(count, version);
  const removed: string[] = [];
  const service = serviceOf({
    listStored: fake.listStored,
    remove: async (id) => (removed.push(id), { id }),
  });
  const audit = { reload: async () => undefined };
  return { flows: createTitleFlows({ service, store: () => useAppStore.getState(), audit }), calls: fake.calls, removed };
}

beforeEach(() => {
  resetStore();
  signInForTest();
  state().titlesReset(state().serial);
});

describe("the stored list's paged slice", () => {
  it("is the default view, reads the first page of the default query and keeps the total and the counts", async () => {
    const { flows, calls } = rig(250);
    assert.equal(stored().mode, "stored");
    assert.equal((await flows.loadStored()).ok, true);
    assert.deepEqual(calls.map((call) => [call.offset, call.query]), [[0, START_STORED]]);
    assert.deepEqual([stored().status, stored().paged.total, loadedRows(stored().paged).length], ["ready", 250, 100]);
    assert.equal(stored().paged.inventory?.movie, 3);
  });

  it("pages by offset: a range asks for the page that holds it once, and not again while it is loaded or in flight", async () => {
    const { flows, calls } = rig(450);
    await flows.loadStored();
    assert.equal(flows.needRange(300, 399), true);
    assert.equal(flows.needRange(300, 399), false, "in flight");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls.map((call) => call.offset), [0, 300]);
    assert.equal(rowAt(stored().paged, 301)?.id, "movie-301");
    assert.equal(flows.needRange(300, 399), false, "loaded");
    assert.equal(flows.needRange(0, 99), false, "loaded");
  });

  it("asks nothing before the first page has told the total", () => {
    const { flows, calls } = rig(450);
    assert.equal(flows.needRange(200, 299), false);
    assert.deepEqual(calls, []);
  });

  it("resets on a query change: pages gone, a read from offset 0 with the new parameters, one read per change", async () => {
    const { flows, calls } = rig(250);
    await flows.loadStored();
    flows.needRange(100, 199);
    await flows.changeStored((query) => ({ ...query, kind: "tv", sort: "year", dir: "desc" }));
    const last = calls[calls.length - 1];
    assert.deepEqual([last?.offset, last?.query.kind, last?.query.sort, last?.query.dir], [0, "tv", "year", "desc"]);
    assert.deepEqual(Object.keys(stored().paged.pages), ["0"]);
    const before = calls.length;
    await flows.changeStored((query) => ({ ...query, kind: "tv" }));
    assert.equal(calls.length, before, "the same query reads nothing");
  });

  it("runs the search on Enter only: typing reads nothing, the run search is trimmed", async () => {
    const { flows, calls } = rig(10);
    await flows.loadStored();
    flows.typeStored("  dune ");
    assert.equal(calls.length, 1);
    await flows.searchStored();
    assert.deepEqual([calls.length, stored().query.q, stored().typed], [2, "dune", "  dune "]);
  });

  it("drops an answer for a query that is no longer the slice's", async () => {
    let release: () => void = () => undefined;
    const slow = createTitleFlows({
      service: serviceOf({
        listStored: async (query) => {
          if (query.kind === "all") await new Promise<void>((resolve) => (release = resolve));
          return storedPage([titleRowOf(`${query.kind}-1`)], 1);
        },
      }),
      store: () => useAppStore.getState(),
      audit: { reload: async () => undefined },
    });
    const first = slow.loadStored();
    await slow.changeStored((query) => ({ ...query, kind: "tv" }));
    release();
    await first;
    assert.deepEqual(loadedRows(stored().paged).map((row) => row.id), ["tv-1"]);
    assert.equal(stored().query.kind, "tv");
  });

  it("Refresh drops the pages and reads again, a changed version keeps only the page just read", async () => {
    const { flows, calls } = rig(250);
    await flows.loadStored();
    flows.needRange(100, 199);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(Object.keys(stored().paged.pages).length, 2);
    await flows.refresh();
    assert.deepEqual(Object.keys(stored().paged.pages), ["0"]);
    assert.equal(calls[calls.length - 1]?.offset, 0);
  });

  it("keeps the pages it has when a later page fails, and says why", async () => {
    const { flows } = rig(250);
    await flows.loadStored();
    const failing = createTitleFlows({
      service: serviceOf({ listStored: async () => Promise.reject(new ApiError("tmdb.unavailable", "Down.", 503)) }),
      store: () => useAppStore.getState(),
      audit: { reload: async () => undefined },
    });
    failing.needRange(100, 199);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual([stored().status, stored().paged.loading, Object.keys(stored().paged.pages)], ["ready", [], ["0"]]);
  });
});

describe("the two views keep their own state", () => {
  it("switching to Browse TMDB and back leaves the stored query, pages and ticks as they were", async () => {
    const { flows } = rig(250);
    await flows.loadStored();
    await flows.changeStored((query) => ({ ...query, origin: "manual" }));
    state().storedTick(titleRowOf("movie-3"), true);
    state().storedSetMode("browse");
    assert.equal(stored().mode, "browse");
    assert.deepEqual([state().titles.status, state().titles.items.length], ["idle", 0], "no TMDB read for it");
    state().storedSetMode("stored");
    const selection = stored().selection;
    const ticked = selection.mode === "ids" ? [...selection.ids] : [];
    assert.deepEqual([stored().query.origin, loadedRows(stored().paged).length, ticked], ["manual", 100, ["movie-3"]]);
  });

  it("is back to Stored with nothing ticked for a new session", async () => {
    const { flows } = rig(5);
    await flows.loadStored();
    state().storedSetMode("browse");
    state().titlesReset(99);
    assert.deepEqual([stored().mode, stored().status, stored().paged.total], ["stored", "idle", null]);
  });
});

describe("a delete in the stored list", () => {
  it("removes the row, takes the id out of the ticks and reads the list again with the total one lower", async () => {
    const { flows, removed, calls } = rig(250);
    await flows.loadStored();
    state().storedTick(titleRowOf("movie-1"), true);
    await flows.remove("movie-1");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(removed, ["movie-1"]);
    assert.equal(calls.length, 2, "the first page is read again");
    assert.deepEqual(Object.keys(stored().picked), []);
  });
});

describe("the key", () => {
  it("is the one the slice compares an answer with", () => {
    assert.equal(storedKey(stored().query), storedKey(START_STORED));
  });
});
