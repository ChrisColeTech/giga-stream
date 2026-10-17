import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  ChannelSearchSession,
  LastChannelSession,
  readChannels,
  refreshChannels,
  refreshFilteredChannels,
  rememberLastChannel,
  type ChannelQuery,
} from "@/services/channels";
import type { ChannelListAnswer } from "@/services/schemas/channel-schema";
import { useAppStore } from "@/store/app-store";

const originalFetch = globalThis.fetch;
const list: ChannelListAnswer = {
  items: [{
    id: "news",
    name: "News",
    category: "News",
    number: "1",
    revision: 2,
    streamUrl: "https://stream.test/news.m3u8",
    status: "live",
  }],
  categories: [{ value: "News", count: 1 }],
  revision: 2,
};
const success = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));
afterEach(() => { globalThis.fetch = originalFetch; });

describe("channel routes", () => {
  it("sends the exact GET query and validates its channel list", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/channels?q=night+desk&category=News");
      assert.equal(init?.method, "GET");
      return success(list);
    };
    assert.deepEqual(await readChannels({ query: " night desk ", category: "News" }), list);
  });

  it("posts refresh and patches the last channel", async () => {
    const calls: Array<{ input: string; method?: string; body?: BodyInit | null }> = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ input: String(input), method: init?.method, body: init?.body });
      return calls.length === 1 ? success(list) : success({ id: "news" });
    };
    assert.deepEqual(await refreshChannels(), list);
    assert.deepEqual(await rememberLastChannel("news"), { id: "news" });
    assert.deepEqual(calls.map((call) => [call.input, call.method]), [
      ["/api/channels/refresh", "POST"],
      ["/api/channels/last", "PATCH"],
    ]);
    assert.equal(calls[1]?.body, JSON.stringify({ channelId: "news" }));
  });

  it("re-reads the active server filter after refresh", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return success(list);
    };
    assert.deepEqual(await refreshFilteredChannels({ query: "night", category: "News" }), list);
    assert.deepEqual(calls, [
      "/api/channels/refresh",
      "/api/channels?q=night&category=News",
    ]);
  });

  it("refuses malformed channel data and keeps server refusal sentences", async () => {
    globalThis.fetch = async () => success({ ...list, items: [{ ...list.items[0], status: "future" }] });
    await assert.rejects(readChannels(), { code: "response.invalid" });
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: false,
      error: { code: "backend.unreachable", message: "The backend is unavailable." },
    }), { status: 503 });
    await assert.rejects(refreshChannels(), { code: "backend.unreachable", message: "The backend is unavailable." });
  });
});

describe("LastChannelSession", () => {
  it("serializes rapid activations so the newest channel persists last", async () => {
    const pending: Array<{ id: string; resolve: () => void; reject: (error: Error) => void }> = [];
    const refusals: unknown[] = [];
    const session = new LastChannelSession(refusals.push.bind(refusals), {
      write: (id) => new Promise((resolve, reject) => {
        pending.push({ id, resolve: () => resolve({ id }), reject });
      }),
    });
    session.remember("a");
    session.remember("b");
    assert.deepEqual(pending.map((item) => item.id), ["a"]);
    pending[0]?.resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(pending.map((item) => item.id), ["a", "b"]);
    pending[1]?.resolve();
    await Promise.resolve();
    assert.deepEqual(refusals, []);
  });

  it("suppresses a stale refusal when a newer activation is waiting", async () => {
    const pending: Array<{ id: string; reject: (error: Error) => void }> = [];
    const refusals: unknown[] = [];
    const session = new LastChannelSession(refusals.push.bind(refusals), {
      write: (id) => new Promise((_resolve, reject) => pending.push({ id, reject })),
    });
    session.remember("a");
    session.remember("b");
    pending[0]?.reject(new Error("A failed."));
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(refusals, []);
    assert.equal(pending[1]?.id, "b");
  });
});

describe("ChannelSearchSession", () => {
  it("waits 250 ms, aborts superseded reads and ignores their stale result", async () => {
    const scheduled = new Map<number, { callback: () => void; delay: number }>();
    const pending: Array<{
      query: ChannelQuery;
      signal?: AbortSignal;
      resolve: (answer: ChannelListAnswer) => void;
    }> = [];
    let nextHandle = 0;
    const results: ChannelListAnswer[] = [];
    const session = new ChannelSearchSession(results.push.bind(results), () => assert.fail("unexpected refusal"), {
      read: (query, signal) => new Promise((resolve) => pending.push({ query: query ?? {}, signal, resolve })),
      schedule: (callback, delay) => {
        const handle = ++nextHandle;
        scheduled.set(handle, { callback, delay });
        return handle;
      },
      cancel: (handle) => { scheduled.delete(handle); },
    });

    session.search({ query: "n", category: "all" });
    assert.equal(scheduled.get(1)?.delay, 250);
    scheduled.get(1)?.callback();
    session.search({ query: "news", category: "News" });
    assert.equal(pending[0]?.signal?.aborted, true);
    scheduled.get(2)?.callback();
    pending[0]?.resolve({ ...list, revision: 1 });
    pending[1]?.resolve({ ...list, revision: 2 });
    await Promise.resolve();
    assert.deepEqual(pending[1]?.query, { query: "news", category: "News" });
    assert.deepEqual(results.map((answer) => answer.revision), [2]);
  });

  it("reports one refusal without replacing the caller's last good rows", async () => {
    const rows = [list];
    const refusals: unknown[] = [];
    const session = new ChannelSearchSession(rows.push.bind(rows), refusals.push.bind(refusals), {
      read: async () => { throw new Error("Search was refused."); },
      schedule: () => 1,
      cancel: () => undefined,
    });
    session.readNow({ query: "missing" });
    await Promise.resolve();
    assert.deepEqual(rows, [list]);
    assert.equal(refusals.length, 1);
  });
});
