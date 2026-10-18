import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { loadedRows } from "@/lib/title-paged";
import type { TitleList } from "@/services/schemas/title-schema";
import { createTitleFlows } from "@/services/title-flows";
import type { TitlesService } from "@/services/titles";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";
import { serviceOf, storedPage, titleRowOf } from "./support/titles-stored-kit";

/* Search as you type (`docs/41` section 6): a new query aborts the previous request, an aborted or older answer says
 * nothing and changes nothing, typing alone reads nothing. */

const state = () => useAppStore.getState();
const stored = () => state().titlesStored;
const abortError = (): DOMException => new DOMException("The operation was aborted.", "AbortError");

/** A call that waits until its signal aborts (then rejects as `fetch` does) or until it is released. */
function held(signal: AbortSignal | undefined, release: Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.addEventListener("abort", () => reject(abortError()));
    void release.then(resolve);
  });
}

const browsePage = (id: string): TitleList => ({
  items: [{ id, kind: "movie", title: id, state: "synced" }],
  page: 1,
  totalPages: 1,
  totalResults: 1,
  unreadable: 0,
});

beforeEach(() => {
  resetStore();
  signInForTest();
  state().titlesReset(state().serial);
});

describe("the stored list", () => {
  function rig() {
    const signals: (AbortSignal | undefined)[] = [];
    const queries: string[] = [];
    const service = serviceOf({
      listStored: async (query, _offset, _limit, signal) => {
        signals.push(signal);
        queries.push(query.q);
        await held(signal, new Promise<void>((resolve) => setImmediate(resolve)));
        return storedPage([titleRowOf(`movie-${query.q || "all"}`)], 1);
      },
    });
    const flows = createTitleFlows({ service, store: () => state(), audit: { reload: async () => undefined } });
    return { flows, signals, queries };
  }

  it("typing reads nothing; the debounce's search reads once, from the top, with the trimmed text", async () => {
    const { flows, queries } = rig();
    await flows.loadStored();
    flows.typeStored("d");
    flows.typeStored("  dune ");
    assert.deepEqual(queries, [""], "no read while typing");
    await flows.searchStored();
    assert.deepEqual([queries, stored().query.q, stored().typed], [["", "dune"], "dune", "  dune "]);
  });

  it("a new search aborts the request in flight and the older answer is dropped", async () => {
    const { flows, signals } = rig();
    flows.typeStored("d");
    const first = flows.searchStored();
    flows.typeStored("du");
    const second = flows.searchStored();
    assert.equal(signals[0]?.aborted, true, "the first request was aborted");
    assert.equal(signals[1]?.aborted, false);
    assert.equal((await first).ok, false, "an aborted read is dropped");
    await second;
    assert.deepEqual(loadedRows(stored().paged).map((one) => one.id), ["movie-du"]);
    assert.equal(stored().query.q, "du");
  });

  it("an aborted read says nothing and does not mark the list failed", async () => {
    const { flows } = rig();
    flows.typeStored("a");
    const first = flows.searchStored();
    flows.typeStored("ab");
    const second = flows.searchStored();
    await first;
    assert.equal(state().notice, null, "no notice for an abort");
    assert.equal(stored().status, "loading", "the newer query is still loading, not failed");
    await second;
    assert.equal(stored().status, "ready");
  });

  it("a filter change and Refresh abort the previous request too", async () => {
    const { flows, signals } = rig();
    void flows.loadStored();
    void flows.changeStored((query) => ({ ...query, kind: "tv" }));
    assert.equal(signals[0]?.aborted, true);
    const reread = flows.loadStored();
    assert.equal(signals[1]?.aborted, true, "Refresh replaces the filter's read");
    await reread;
    assert.equal(signals[2]?.aborted, false);
  });

  it("the same text again reads nothing", async () => {
    const { flows, queries } = rig();
    flows.typeStored("dune");
    await flows.searchStored();
    flows.typeStored("dune ");
    await flows.searchStored();
    assert.equal(queries.length, 1);
  });

  it("clearing the field searches the whole store again, from the top", async () => {
    const { flows, queries } = rig();
    flows.typeStored("dune");
    await flows.searchStored();
    flows.typeStored("");
    await flows.searchStored();
    assert.deepEqual(queries, ["dune", ""]);
    assert.equal(stored().query.q, "");
  });
});

describe("the browse list", () => {
  function rig() {
    const signals: (AbortSignal | undefined)[] = [];
    const calls: string[] = [];
    const service: TitlesService = {
      ...serviceOf({}),
      list: async (_query, signal) => {
        signals.push(signal);
        calls.push("list");
        await held(signal, new Promise<void>((resolve) => setImmediate(resolve)));
        return browsePage("movie-browse");
      },
      search: async (query, signal) => {
        signals.push(signal);
        calls.push(`search:${query.q}:${query.kind}`);
        await held(signal, new Promise<void>((resolve) => setImmediate(resolve)));
        return browsePage(`${query.kind}-${query.q}`);
      },
    };
    const flows = createTitleFlows({ service, store: () => state(), audit: { reload: async () => undefined } });
    return { flows, signals, calls };
  }

  it("a new search aborts the request in flight, drops its answer and says nothing", async () => {
    const { flows, signals } = rig();
    flows.type("d");
    const first = flows.search();
    flows.type("du");
    const second = flows.search();
    assert.equal(signals[0] !== undefined && signals.slice(0, 2).every((one) => one?.aborted), true, "both kinds of the first read");
    assert.equal((await first).ok, false);
    await second;
    assert.deepEqual(state().titles.items.map((one) => one.id).sort(), ["movie-du", "tv-du"]);
    assert.equal(state().notice, null);
    assert.equal(state().titles.status, "ready");
  });

  it("typing alone reads nothing, and the same search again reads nothing", async () => {
    const { flows, calls } = rig();
    flows.type("dune");
    assert.deepEqual(calls, []);
    await flows.search();
    const before = calls.length;
    flows.type("dune ");
    await flows.search();
    assert.equal(calls.length, before);
  });

  it("clearing the field returns to the browse list", async () => {
    const { flows, calls } = rig();
    flows.type("dune");
    await flows.search();
    flows.type("");
    await flows.search();
    assert.equal(calls[calls.length - 1], "list");
    assert.equal(state().titles.view.search, "");
  });
});
