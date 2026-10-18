import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPreviewSession, SESSION_START, type PreviewSessionState } from "@/lib/preview-session";

/** A read the test answers by hand, counting the calls. */
function manual() {
  let reads = 0;
  let answer: () => void = () => undefined;
  const read = (): Promise<void> => {
    reads += 1;
    return new Promise<void>((resolve) => (answer = resolve));
  };
  return { read, reads: () => reads, answer: () => answer() };
}

describe("the Preview's reads", () => {
  it("reads once on open, and the stage waits while it runs", async () => {
    const backend = manual();
    const states: PreviewSessionState[] = [];
    const session = createPreviewSession(backend.read, (state) => states.push(state));
    assert.equal(SESSION_START.reading, true);
    const opened = session.open();
    assert.equal(backend.reads(), 1);
    backend.answer();
    await opened;
    assert.deepEqual(states.at(-1), { reading: false, attempt: 0 });
  });

  it("reads exactly once per Retry and raises the attempt so the player attaches again", async () => {
    const backend = manual();
    const states: PreviewSessionState[] = [];
    const session = createPreviewSession(backend.read, (state) => states.push(state));
    const opened = session.open();
    backend.answer();
    await opened;
    const retried = session.retry();
    void session.retry();
    assert.equal(backend.reads(), 2, "a second press while the first read runs reads nothing");
    backend.answer();
    await retried;
    assert.deepEqual(states.at(-1), { reading: false, attempt: 1 });
  });

  it("never reads by itself: no timer, no poll", async () => {
    const backend = manual();
    const session = createPreviewSession(backend.read, () => undefined);
    const opened = session.open();
    backend.answer();
    await opened;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    assert.equal(backend.reads(), 1);
  });

  it("says nothing once the window has closed", async () => {
    const backend = manual();
    const states: PreviewSessionState[] = [];
    const session = createPreviewSession(backend.read, (state) => states.push(state));
    const opened = session.open();
    const before = states.length;
    session.close();
    backend.answer();
    await opened;
    assert.equal(states.length, before);
  });
});
