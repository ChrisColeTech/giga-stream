import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_SUBSCRIBERS_MAX } from "../src/constants/limits.js";
import { createJobEvents, type EventSink } from "../src/services/job-events.js";
import { createJobProgress } from "../src/services/job-progress.js";

function sink() {
  const chunks: string[] = [];
  let ended = 0;
  const writer: EventSink = {
    write: (chunk) => { chunks.push(chunk); return true; },
    end: () => { ended++; },
  };
  return { writer, chunks, ended: () => ended };
}

test("external events write one empty snapshot and end synchronously without retaining a sink", () => {
  const progress = createJobProgress({ now: () => 1 });
  const report = progress.start(6, "movies");
  let subscriptions = 0;
  const events = createJobEvents({ enabled: false, progress: {
    ...progress, subscribe: (listener) => { subscriptions++; return progress.subscribe(listener); },
  } });
  assert.equal(subscriptions, 0, "no progress listener is needed in the passive API");
  for (let i = 0; i < EVENT_SUBSCRIBERS_MAX + 2; i++) {
    const client = sink();
    const leave = events.attach({
      write: (chunk) => { assert.equal(events.count(), 0); return client.writer.write(chunk); },
      end: client.writer.end,
    });
    assert.deepEqual(client.chunks, ['event: snapshot\ndata: {"running":[]}\n\n']);
    assert.equal(client.ended(), 1);
    assert.equal(events.count(), 0);
    report({ phase: "movies", done: 1, total: 1 });
    progress.finish({ jobId: 6, lastResult: "ok" });
    leave();
    leave();
    events.closeAll();
    assert.equal(client.chunks.length, 1);
    assert.equal(client.ended(), 1, "cleanup cannot end an already-finished finite response again");
  }
});

test("external events end even when the snapshot write backpressures or throws", () => {
  const events = createJobEvents({ enabled: false, progress: createJobProgress({ now: () => 1 }) });
  for (const throws of [false, true]) {
    let ended = 0;
    events.attach({
      write: () => { if (throws) throw new Error("closed socket"); return false; },
      end: () => { ended++; },
    });
    assert.equal(ended, 1);
    assert.equal(events.count(), 0);
  }
});

test("default and explicit inline mode retain the stream and publish progress until disconnected", () => {
  for (const enabled of [undefined, true]) {
    const progress = createJobProgress({ now: () => 1 });
    const report = progress.start(6, "movies");
    const events = createJobEvents({ progress, enabled });
    const client = sink();
    const leave = events.attach(client.writer);
    assert.equal(events.count(), 1);
    assert.equal(client.ended(), 0);
    assert.match(client.chunks[0] ?? "", /"running":\[\{"jobId":6/);
    report({ phase: "movies", done: 2, total: 2 });
    progress.finish({ jobId: 6, lastResult: "ok", lastRunAt: 2 });
    assert.deepEqual(client.chunks.slice(1), [
      'event: progress\ndata: {"jobId":6,"phase":"movies","done":2,"total":2}\n\n',
      'event: finished\ndata: {"jobId":6,"lastResult":"ok","lastRunAt":2}\n\n',
    ]);
    assert.equal(client.ended(), 0, "a job finishing does not close inline SSE");
    leave();
    leave();
    assert.equal(events.count(), 0);
    assert.equal(client.ended(), 1);
  }
});
