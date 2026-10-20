import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { WatchEntry } from "@/services/schemas/watch-schema";
import { type LocalWatch, setSharedLocalWatch } from "@/services/local-watch";
import { onDesktopRuntime } from "@/services/persistence";
import { clearWatch, removeWatch, writeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;

const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

function browserWindow(): void {
  (globalThis as { window?: unknown }).window = {};
}

function desktopWindow(): void {
  (globalThis as { window?: unknown }).window = { pocHost: { runtime: "electron" } };
}

/** A `LocalWatch` that records what it is asked, answering entries built from the write, so the transport's answers
 *  keep the shape the Player and the store read. */
function recordingStore(calls: string[]): LocalWatch {
  const entryOf = (write: Parameters<LocalWatch["write"]>[0]): WatchEntry => ({
    watchId: `watch-${write.seq}`,
    item: write.item,
    ...(write.season === undefined ? {} : { season: write.season }),
    ...(write.episode === undefined ? {} : { episode: write.episode }),
    positionMs: write.positionMs,
    ...(write.durationMs === undefined ? {} : { durationMs: write.durationMs }),
    state: "watching",
    updatedAt: 1,
  });
  const written: WatchEntry[] = [];
  return {
    write: async (write) => {
      calls.push(`write:${write.positionMs}`);
      return { applied: true, entry: entryOf(write) };
    },
    remove: async (watchId) => {
      calls.push(`remove:${watchId}`);
      return { removed: watchId };
    },
    clear: async () => {
      calls.push("clear");
      return { cleared: written.length };
    },
    entries: async () => written,
    continueSelection: async () => [],
    historyPage: async () => ({ items: [], total: 0 }),
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Reflect.deleteProperty(globalThis, "window");
  setSharedLocalWatch(null);
});

describe("the watch transport over the resolver (`61` section 2.5)", () => {
  it("on the desktop the three calls are the exact REST transport, keepalive included", async () => {
    desktopWindow();
    assert.equal(onDesktopRuntime(), true);
    const calls: Array<{ input: string; method?: string; body?: string; keepalive?: boolean }> = [];
    globalThis.fetch = async (input, init) => {
      const path = String(input);
      calls.push({
        input: path, method: init?.method,
        body: typeof init?.body === "string" ? init.body : undefined,
        keepalive: init?.keepalive === true ? true : undefined,
      });
      // Each route its own answer shape: the schemas at the boundary are exact, so a write answer would not parse
      // as a removal or a clear.
      if (init?.method === "PUT") return success({ applied: true, entry: null });
      if (path === "/api/watch/watch-1") return success({ removed: "watch-1" });
      return success({ cleared: 2 });
    };
    const answer = await writeWatch({
      item: { kind: "title", id: "t1" }, positionMs: 5_000, durationMs: 10_000, playbackId: "p1", seq: 3,
    });
    assert.deepEqual(answer, { applied: true, entry: null });
    await writeWatch({ item: { kind: "title", id: "t1" }, positionMs: 6_000, playbackId: "p1", seq: 4 },
      { keepalive: true });
    await removeWatch("watch-1");
    await clearWatch();
    assert.deepEqual(calls.map((call) => [call.input, call.method, call.keepalive]), [
      ["/api/watch", "PUT", undefined],
      ["/api/watch", "PUT", true],
      ["/api/watch/watch-1", "DELETE", undefined],
      ["/api/watch", "DELETE", undefined],
    ]);
    assert.equal(JSON.parse(calls[0]?.body ?? "null")?.positionMs, 5_000);
  });

  it("in a browser the same calls go to the local store and no request leaves the page", async () => {
    browserWindow();
    assert.equal(onDesktopRuntime(), false);
    const calls: string[] = [];
    setSharedLocalWatch(Promise.resolve(recordingStore(calls)));
    globalThis.fetch = async () => {
      throw new Error("no request may leave the page");
    };
    const answer = await writeWatch({
      item: { kind: "title", id: "t1" }, positionMs: 5_000, playbackId: "p1", seq: 1,
    }, { keepalive: true });
    assert.equal(answer.entry?.watchId, "watch-1");
    assert.deepEqual(await removeWatch("watch-9"), { removed: "watch-9" });
    assert.deepEqual(await clearWatch(), { cleared: 0 });
    assert.deepEqual(calls, ["write:5000", "remove:watch-9", "clear"]);
  });
});
