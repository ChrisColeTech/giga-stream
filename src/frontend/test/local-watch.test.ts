import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  openLocalWatch,
} from "@/services/local-watch";
import {
  WATCH_STORE_NAME,
  type IdbFactoryLike,
  type IdbOpenRequestLike,
  type IdbRequestLike,
  type IdbStoreLike,
} from "@/services/local-watch-idb";
import type { WatchWrite } from "@/services/schemas/watch-schema";
import { useAppStore } from "@/store/app-store";

const state = () => useAppStore.getState();

/** A minimal IndexedDB over a plain map, shaped exactly like the structural contract `local-watch.ts` names. The
 *  requests settle on the next microtask and the transactions on the next macrotask, so every awaited store
 *  operation is genuinely async and completes in order. */
function stubFactory(seed: Map<string, unknown> = new Map(), failPut = false): IdbFactoryLike & { rows: Map<string, unknown> } {
  const rows = seed;
  const settled = <T>(result: T): IdbRequestLike<T> => {
    const request: IdbRequestLike<T> = { result, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => request.onsuccess?.(new Event("success")));
    return request;
  };
  const refused = (): IdbRequestLike<unknown> => {
    const request: IdbRequestLike<unknown> = {
      result: undefined, error: new DOMException("quota", "QuotaExceededError"), onsuccess: null, onerror: null,
    };
    queueMicrotask(() => request.onerror?.(new Event("error")));
    return request;
  };
  const store: IdbStoreLike = {
    getAll: () => settled([...rows.values()]),
    put: (value, key) => {
      if (failPut) return refused();
      rows.set(key, value);
      return settled(key);
    },
    delete: (key) => {
      rows.delete(key);
      return settled(key);
    },
    clear: () => {
      rows.clear();
      return settled(undefined);
    },
  };
  const database = {
    objectStoreNames: { contains: (name: string) => name === WATCH_STORE_NAME },
    createObjectStore: (_name: string): IdbStoreLike => store,
    transaction: (_names: readonly string[], _mode: "readonly" | "readwrite") => {
      const handle = {
        objectStore: (_name: string): IdbStoreLike => store,
        error: null as DOMException | null,
        oncomplete: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
      };
      setTimeout(() => handle.oncomplete?.(new Event("complete")), 0);
      return handle;
    },
  };
  return {
    rows,
    open: (_name: string, _version: number): IdbOpenRequestLike => {
      const request: IdbOpenRequestLike = {
        result: database, error: null,
        onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.(new IDBVersionChangeEvent("upgradeneeded", { oldVersion: 0, newVersion: 1 }));
        request.onsuccess?.(new Event("success"));
      });
      return request;
    },
  };
}

const write = (over: Partial<WatchWrite> = {}): WatchWrite => ({
  item: { kind: "title", id: "t1" },
  positionMs: 100,
  playbackId: "p1",
  seq: 1,
  ...over,
});

const open = (factory: IdbFactoryLike, now: () => number = () => 1_000) => openLocalWatch({
  factory, now, watchedPercent: () => 90,
});

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the local watch store", () => {
  it("round-trips writes through the identity key, keeping one entry per identity", async () => {
    const factory = stubFactory();
    const store = await open(factory);
    const first = await store.write(write({ durationMs: 1_000 }));
    assert.equal(first.applied, true);
    assert.equal(first.entry?.state, "watching");
    const second = await store.write(write({ durationMs: 1_000, positionMs: 950, seq: 2 }));
    assert.equal(second.entry?.watchId, first.entry?.watchId);
    assert.equal(second.entry?.state, "watched");
    assert.equal(second.entry?.updatedAt, 1_000);
    assert.deepEqual([...factory.rows.keys()], ["title:t1:-1:-1"]);
    assert.deepEqual(await store.entries(), [second.entry]);
  });

  it("applies the shared threshold and clamp at write time, and watched is sticky", async () => {
    const store = await open(stubFactory());
    const clamped = await store.write(write({ durationMs: 1_000, positionMs: 1_200 }));
    assert.equal(clamped.entry?.positionMs, 1_000);
    assert.equal(clamped.entry?.state, "watched");
    const back = await store.write(write({ durationMs: 1_000, positionMs: 0, seq: 2 }));
    assert.equal(back.entry?.state, "watched");
    const noDuration = await store.write(write({ item: { kind: "title", id: "t2" } }));
    assert.equal(noDuration.entry?.state, "watching");
  });

  it("refuses a write whose seq is not higher for its playback, answering the entry as it stands", async () => {
    const store = await open(stubFactory());
    await store.write(write({ durationMs: 1_000 }));
    const stale = await store.write(write({ durationMs: 1_000, positionMs: 500, seq: 1 }));
    assert.equal(stale.applied, false);
    assert.equal(stale.entry?.positionMs, 100);
    const freshPlayback = await store.write(write({ durationMs: 1_000, positionMs: 500, playbackId: "p2" }));
    assert.equal(freshPlayback.applied, true);
    assert.equal(freshPlayback.entry?.positionMs, 500);
  });

  it("keeps episodes apart, and builds Continue and the history page on the shared selections", async () => {
    let at = 0;
    const store = await open(stubFactory(), () => (at += 10));
    await store.write(write({ item: { kind: "title", id: "s1" }, season: 1, episode: 1, durationMs: 1_000 }));
    await store.write(write({
      item: { kind: "title", id: "s1" }, season: 1, episode: 2, durationMs: 1_000, positionMs: 950, seq: 2,
    }));
    await store.write(write({ item: { kind: "title", id: "m1" }, durationMs: 1_000, positionMs: 10 }));
    // The series' newest entry is watched, so the item has left Continue even though the first episode is mid-way.
    const continuing = await store.continueSelection(10);
    assert.deepEqual(continuing.map((entry) => entry.item.id), ["m1"]);
    assert.deepEqual(await store.continueSelection(0), []);
    const page = await store.historyPage(0, 2);
    assert.equal(page.total, 3);
    assert.deepEqual(page.items.map((entry) => entry.item.id), ["m1", "s1"]);
    assert.equal(page.items[1]?.episode, 2);
    const second = await store.historyPage(1, 2);
    assert.equal(second.total, 3);
    assert.deepEqual(second.items.map((entry) => entry.item.id), ["s1"]);
    const past = await store.historyPage(9, 2);
    assert.deepEqual(past.items, []);
    assert.equal(past.total, 3);
  });

  it("removes by watch id, refuses an unknown one, and clears the rest", async () => {
    const store = await open(stubFactory());
    const first = await store.write(write({ item: { kind: "title", id: "t1" } }));
    await store.write(write({ item: { kind: "title", id: "t2" } }));
    const watchId = first.entry?.watchId ?? "";
    assert.deepEqual(await store.remove(watchId), { removed: watchId });
    await assert.rejects(store.remove("no-such-watch-id"), /no such watch entry/);
    assert.deepEqual(await store.clear(), { cleared: 1 });
    assert.deepEqual(await store.entries(), []);
    assert.deepEqual(await store.clear(), { cleared: 0 });
  });

  it("drops stored rows the wire schema refuses, and keeps their readable siblings", async () => {
    const seed = new Map<string, unknown>([
      ["title:gone:-1:-1", { watchId: "gone", nonsense: true }],
      ["title:kept:-1:-1", {
        watchId: "kept", item: { kind: "title", id: "kept" }, positionMs: 5, state: "watching", updatedAt: 1,
      }],
    ]);
    const store = await open(stubFactory(seed));
    assert.deepEqual((await store.entries()).map((entry) => entry.watchId), ["kept"]);
  });

  it("degrades to memory for the session when the open fails, and speaks once", async () => {
    const throwing: IdbFactoryLike = {
      open: (_name: string, _version: number): IdbOpenRequestLike => {
        throw new Error("IndexedDB is blocked");
      },
    };
    const store = await open(throwing);
    const written = await store.write(write({ durationMs: 1_000 }));
    assert.equal(written.applied, true);
    assert.deepEqual(await store.entries(), [written.entry]);
    assert.equal(state().notice?.tone, "warn");
    assert.match(state().notice?.sentence ?? "", /kept for this session only/);
    useAppStore.setState({ notice: undefined });
    await store.write(write({ durationMs: 1_000, seq: 2 }));
    assert.equal(state().notice, undefined);
  });

  it("degrades on a failed write, keeps serving from memory and does not speak twice", async () => {
    const store = await open(stubFactory(new Map(), true));
    const written = await store.write(write({ durationMs: 1_000 }));
    assert.equal(written.applied, true);
    assert.deepEqual(await store.entries(), [written.entry]);
    assert.match(state().notice?.sentence ?? "", /kept for this session only/);
    useAppStore.setState({ notice: undefined });
    await store.write(write({ item: { kind: "title", id: "t2" }, durationMs: 1_000 }));
    assert.equal(state().notice, undefined);
  });
});
