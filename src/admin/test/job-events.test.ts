import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { applyEvent, consumeStream, decodeFrame, runJobEvents } from "@/services/job-events";
import { createSseParser } from "@/services/sse-parser";
import { useAppStore } from "@/store/app-store";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const frame = (name: string, data: unknown): string => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const P1 = { jobId: 1, phase: "checking", done: 10, total: 100 };

function bodyOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the SSE frame parser", () => {
  it("waits for the blank line: a frame split at any byte comes out whole, once", () => {
    const text = frame("progress", P1);
    for (let at = 1; at < text.length; at += 1) {
      const parser = createSseParser();
      const frames = [...parser.push(text.slice(0, at)), ...parser.push(text.slice(at))];
      assert.deepEqual(frames, [{ event: "progress", data: JSON.stringify(P1) }], `split at ${at}`);
    }
  });

  it("splits several frames in one chunk, reads CRLF, skips comments and joins data lines", () => {
    const parser = createSseParser();
    const frames = parser.push(`: hello\r\nevent: a\r\ndata: 1\r\n\r\nevent: b\ndata: x\ndata: y\n\nid: 7\n\n`);
    assert.deepEqual(frames, [{ event: "a", data: "1" }, { event: "b", data: "x\ny" }]);
  });

  it("holds a CR that ends a chunk until its LF arrives", () => {
    const parser = createSseParser();
    assert.deepEqual(parser.push("event: a\ndata: 1\r"), []);
    assert.deepEqual(parser.push("\n\r\n"), [{ event: "a", data: "1" }]);
  });
});

describe("decoding a frame", () => {
  it("reads snapshot, progress and finished", () => {
    assert.deepEqual(decodeFrame({ event: "snapshot", data: JSON.stringify({ running: [P1] }) }), {
      type: "snapshot", running: [P1],
    });
    assert.deepEqual(decodeFrame({ event: "progress", data: JSON.stringify(P1) }), { type: "progress", progress: P1 });
    assert.deepEqual(decodeFrame({ event: "finished", data: JSON.stringify({ jobId: 1, lastResult: "stopped" }) }), {
      type: "finished", finished: { jobId: 1, lastResult: "stopped" },
    });
  });

  it("ignores a bad frame: bad JSON, a wrong shape, an unknown name", () => {
    assert.equal(decodeFrame({ event: "progress", data: "{nope" }), null);
    assert.equal(decodeFrame({ event: "progress", data: JSON.stringify({ jobId: "1" }) }), null);
    assert.equal(decodeFrame({ event: "snapshot", data: JSON.stringify({ running: [{ jobId: -1 }] }) }), null);
    assert.equal(decodeFrame({ event: "ping", data: "{}" }), null);
  });
});

describe("following a stream into the store", () => {
  it("applies frames that arrive in pieces, skipping the bad one", async () => {
    const text = frame("snapshot", { running: [P1] }) + "event: progress\ndata: {bad\n\n" + frame("progress", { ...P1, done: 40 });
    const seen: string[] = [];
    await consumeStream(bodyOf(text.slice(0, 20), text.slice(20, 90), text.slice(90)), (event) => seen.push(event.type), new AbortController().signal);
    assert.deepEqual(seen, ["snapshot", "progress"]);
  });

  it("writes progress, mirrors it onto the loaded job and marks the lists stale on finished", () => {
    state().jobsLoaded([{ id: 1, name: "Sync", type: "playlist", enabled: true, schedule: "off", config: { playlistId: 3 }, running: true, createdAt: 1 }]);
    const store = () => useAppStore.getState();
    applyEvent(store, { type: "progress", progress: P1 });
    assert.equal(state().jobProgress.live[0]?.progress.done, 10);
    assert.equal(state().jobs.items[0]?.progress?.done, 10);
    assert.deepEqual([state().stale.jobs, state().stale.playlists], [false, false]);
    applyEvent(store, { type: "finished", finished: { jobId: 1, lastResult: "ok" } });
    assert.deepEqual(state().jobProgress.live, []);
    assert.equal(state().jobs.items[0]?.progress, undefined);
    assert.deepEqual([state().stale.jobs, state().stale.playlists, state().stale.channels], [true, true, true]);
  });

  it("treats a snapshot as authoritative: a job it leaves out has finished", () => {
    const store = () => useAppStore.getState();
    applyEvent(store, { type: "progress", progress: P1 });
    applyEvent(store, { type: "progress", progress: { ...P1, jobId: 2 } });
    applyEvent(store, { type: "snapshot", running: [{ ...P1, jobId: 2, done: 50 }] });
    assert.deepEqual(state().jobProgress.live.map((entry) => entry.progress.jobId), [2]);
    assert.equal(state().stale.jobs, true);
  });

  it("clears the progress and marks the lists stale when the stream ends by itself, and never retries", async () => {
    let opened = 0;
    const stream = async () => {
      opened += 1;
      return bodyOf(frame("snapshot", { running: [P1] }));
    };
    await runJobEvents({ stream, store: () => useAppStore.getState() }, new AbortController().signal);
    assert.equal(opened, 1);
    assert.deepEqual(state().jobProgress.live, []);
    assert.deepEqual([state().stale.jobs, state().stale.playlists, state().stale.channels], [true, true, true]);
  });

  it("clears the progress when the stream cannot open", async () => {
    state().jobProgressUpdate(P1);
    const stream = async (): Promise<ReadableStream<Uint8Array>> => {
      throw new Error("down");
    };
    await runJobEvents({ stream, store: () => useAppStore.getState() }, new AbortController().signal);
    assert.deepEqual(state().jobProgress.live, []);
    assert.equal(state().stale.jobs, true);
  });

  it("leaves the progress and the lists alone when the app aborts the stream (a reopen or a sign-out)", async () => {
    const controller = new AbortController();
    const stream = async () => {
      controller.abort();
      return bodyOf(frame("progress", P1));
    };
    state().jobProgressUpdate({ ...P1, jobId: 9 });
    await runJobEvents({ stream, store: () => useAppStore.getState() }, controller.signal);
    assert.equal(state().jobProgress.live.length, 1);
    assert.equal(state().stale.jobs, false);
  });
});
