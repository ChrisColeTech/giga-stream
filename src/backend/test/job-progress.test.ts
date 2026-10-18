// Job progress (docs/44 sections 3.1 and 3.3): fixed phase weights, a fraction that never goes backwards, and a stream
// throttle that holds back only same-phase `done` increments, judged by the injected clock - never a phase change, a new
// total, `done === total` or `finished`. Then the event stream's subscribers with a fake sink: framing, the snapshot on
// connect, the cap, a refused write ending a subscriber, closeAll. No timers anywhere.
import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../src/constants/errors.js";
import { EVENT_SUBSCRIBERS_MAX, PROGRESS_MIN_GAP_MS } from "../src/constants/limits.js";
import { createJobEvents, type EventSink } from "../src/services/job-events.js";
import { createJobProgress, fractionOf } from "../src/services/job-progress.js";
import type { JobEvent } from "../src/types/job-progress.js";
import { testClock } from "./test-app.js";

function registry() {
  const clock = testClock(1_000_000);
  const progress = createJobProgress({ now: clock.now });
  const events: JobEvent[] = [];
  progress.subscribe((event) => void events.push(event));
  const sent = (): string[] =>
    events.map((e) => (e.type === "progress" ? `${e.progress.phase} ${e.progress.done}/${e.progress.total}` : `finished ${e.jobId}`));
  return { clock, progress, events, sent };
}

test("the phase weights: reading 0, logos 0 to 20%, checking 20 to 100%, movies then series a half each", () => {
  const at = (phase: string, done: number, total: number): number => Math.round(fractionOf({ phase, done, total }) * 1000) / 1000;
  assert.deepEqual([at("reading", 0, 0), at("reading", 5, 9)], [0, 0]);
  assert.deepEqual([at("logos", 0, 0), at("logos", 5, 10), at("logos", 10, 10)], [0, 0.1, 0.2], "before its total is known: the lower bound");
  assert.deepEqual([at("checking", 0, 0), at("checking", 0, 40), at("checking", 20, 40), at("checking", 40, 40)], [0.2, 0.2, 0.6, 1]);
  assert.deepEqual([at("movies", 25, 100), at("movies", 100, 100), at("tv", 0, 100), at("tv", 50, 100), at("tv", 100, 100)], [0.125, 0.5, 0.5, 0.75, 1]);
  assert.deepEqual([at("list", 3, 4), at("movies", 9, 3)], [0.75, 0.5], "any other phase fills the whole bar; a share never passes 1");
});

test("the registry holds the latest value and forgets it when the run finishes", () => {
  const { progress } = registry();
  const report = progress.start(7, "reading");
  assert.deepEqual(progress.get(7), { jobId: 7, phase: "reading", done: 0, total: 0 });
  report({ phase: "checking", done: 3, total: 10 });
  assert.deepEqual(progress.running(), [{ jobId: 7, phase: "checking", done: 3, total: 10 }]);
  progress.finish({ jobId: 7, lastResult: "ok", lastRunAt: 5 });
  assert.deepEqual([progress.get(7), progress.running()], [undefined, []]);
  report({ phase: "checking", done: 4, total: 10 });
  assert.equal(progress.get(7), undefined, "a late report cannot bring a finished run back");
});

test("the bar never goes backwards: a report below the greatest fraction is dropped", () => {
  const { progress, sent } = registry();
  const report = progress.start(1, "movies");
  report({ phase: "movies", done: 40, total: 100 });
  report({ phase: "movies", done: 10, total: 100 });
  report({ phase: "movies", done: 40, total: 400 });
  assert.deepEqual(progress.get(1), { jobId: 1, phase: "movies", done: 40, total: 100 });
  report({ phase: "movies", done: 40, total: 50 });
  assert.equal(progress.get(1)?.total, 50, "a total can only shrink, which moves the bar forward");
  assert.deepEqual(sent(), ["movies 0/0", "movies 40/100", "movies 40/50"]);
});

test("same-phase increments are capped at four a second by the injected clock; nothing else is held back", () => {
  const { clock, progress, sent } = registry();
  const report = progress.start(1, "checking");
  report({ phase: "checking", done: 0, total: 1000 });
  for (let done = 1; done <= 10; done++) report({ phase: "checking", done, total: 1000 });
  assert.deepEqual(sent(), ["checking 0/0", "checking 0/1000"], "ten increments in the same instant: none reaches the stream");
  assert.equal(progress.get(1)?.done, 10, "yet the registry holds the latest");
  clock.advance(PROGRESS_MIN_GAP_MS - 1);
  report({ phase: "checking", done: 11, total: 1000 });
  assert.equal(sent().length, 2, "just under a quarter second");
  clock.advance(1);
  report({ phase: "checking", done: 12, total: 1000 });
  assert.equal(sent().at(-1), "checking 12/1000");
  report({ phase: "checking", done: 13, total: 1000 });
  report({ phase: "checking", done: 1000, total: 1000 });
  assert.equal(sent().at(-1), "checking 1000/1000", "done === total is never held back");
  progress.finish({ jobId: 1, lastResult: "ok", lastRunAt: 9 });
  assert.equal(sent().at(-1), "finished 1", "nor is finished");
});

test("a phase change and a new total are never held back, however soon they follow", () => {
  const { progress, sent } = registry();
  const report = progress.start(1, "reading");
  report({ phase: "logos", done: 0, total: 0 });
  report({ phase: "logos", done: 0, total: 8 });
  report({ phase: "logos", done: 1, total: 8 });
  report({ phase: "checking", done: 0, total: 50 });
  report({ phase: "checking", done: 1, total: 50 });
  report({ phase: "checking", done: 1, total: 40 });
  assert.deepEqual(sent(), ["reading 0/0", "logos 0/0", "logos 0/8", "checking 0/50", "checking 1/40"]);
});

/** A sink that records writes and answers what the test says (a full buffer is `false`). */
function sink(accepts = true) {
  const written: string[] = [];
  const state = { ended: 0, accepts };
  const stream: EventSink = {
    write: (chunk) => {
      written.push(chunk);
      return state.accepts;
    },
    end: () => void (state.ended += 1),
  };
  return { stream, written, state };
}

const frames = (written: string[]): string[] => written.join("").split("\n\n").filter((f) => f !== "");

test("a subscriber gets the snapshot first, then progress and finished as event-stream frames", () => {
  const { progress } = registry();
  const events = createJobEvents({ progress });
  const report = progress.start(3, "movies");
  const one = sink();
  events.attach(one.stream);
  assert.deepEqual(frames(one.written), ['event: snapshot\ndata: {"running":[{"jobId":3,"phase":"movies","done":0,"total":0}]}']);
  report({ phase: "movies", done: 2, total: 2 });
  progress.finish({ jobId: 3, lastResult: "stopped", lastRunAt: 77 });
  assert.deepEqual(frames(one.written).slice(1), [
    'event: progress\ndata: {"jobId":3,"phase":"movies","done":2,"total":2}',
    'event: finished\ndata: {"jobId":3,"lastResult":"stopped","lastRunAt":77}',
  ]);
  const later = sink();
  events.attach(later.stream);
  assert.deepEqual(frames(later.written), ['event: snapshot\ndata: {"running":[]}'], "a late client sees only what still runs");
});

test("at most eight subscribers; the ninth is refused with a normal error, and a leaver makes room", () => {
  const events = createJobEvents({ progress: registry().progress });
  const leave = Array.from({ length: EVENT_SUBSCRIBERS_MAX }, () => events.attach(sink().stream));
  assert.equal(events.count(), EVENT_SUBSCRIBERS_MAX);
  assert.throws(() => events.attach(sink().stream), (e: unknown) => e instanceof AppError && e.code === "job.events_busy");
  assert.throws(() => events.assertRoom(), AppError);
  leave[0]?.();
  leave[0]?.();
  assert.equal(events.count(), EVENT_SUBSCRIBERS_MAX - 1, "leaving twice leaves once");
  events.attach(sink().stream);
});

test("a write the sink refuses ends that subscriber only; a throwing sink is treated alike", () => {
  const { progress } = registry();
  const events = createJobEvents({ progress });
  const full = sink(false);
  const healthy = sink();
  const broken: EventSink = { write: () => { throw new Error("socket closed"); }, end: () => { throw new Error("gone"); } };
  events.attach(healthy.stream);
  events.attach(full.stream);
  assert.deepEqual([events.count(), full.state.ended], [1, 1], "the snapshot write already failed: it never stayed");
  events.attach(broken);
  assert.equal(events.count(), 1);
  full.state.accepts = true;
  const report = progress.start(1, "reading");
  report({ phase: "checking", done: 1, total: 1 });
  assert.equal(frames(healthy.written).length, 3, "the healthy one still gets everything");
  assert.equal(frames(full.written).length, 1, "the ended one gets nothing more");
});

test("closeAll ends every subscriber, once", () => {
  const events = createJobEvents({ progress: registry().progress });
  const sinks = [sink(), sink(), sink()];
  for (const s of sinks) events.attach(s.stream);
  events.closeAll();
  events.closeAll();
  assert.deepEqual(sinks.map((s) => s.state.ended), [1, 1, 1]);
  assert.equal(events.count(), 0);
});
