import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { fractionOf, percentOf } from "@/lib/job-fraction";
import { streamEndPlan, streamKeyOf } from "@/lib/job-events-plan";
import { jobRow, stateOfJob } from "@/lib/job-rows";
import { progressWords } from "@/lib/progress-words";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { resetStore } from "./support/store";

const state = () => useAppStore.getState();
const at = (phase: string, done: number, total: number) => ({ jobId: 1, phase, done, total });
const ids = () => state().jobProgress.live.map((entry) => entry.progress.jobId);

beforeEach(() => resetStore());

describe("fractionOf", () => {
  it("weights a playlist run: reading 0, logos 0-20%, checking 20-100%", () => {
    assert.equal(fractionOf(at("reading", 0, 0)), 0);
    assert.equal(fractionOf(at("logos", 0, 0)), 0);
    assert.equal(fractionOf(at("logos", 156, 312)), 0.1);
    assert.equal(fractionOf(at("logos", 312, 312)), 0.2);
    assert.equal(fractionOf(at("checking", 0, 2598)), 0.2);
    assert.ok(Math.abs(fractionOf(at("checking", 1299, 2598)) - 0.6) < 1e-12);
    assert.equal(fractionOf(at("checking", 2598, 2598)), 1);
  });

  it("gives the Library fill a half per kind and any other scope the whole bar", () => {
    assert.equal(fractionOf(at("movies", 50, 100)), 0.25);
    assert.equal(fractionOf(at("tv", 0, 100)), 0.5);
    assert.equal(fractionOf(at("tv", 100, 100)), 1);
    assert.equal(fractionOf(at("list", 3, 4)), 0.75);
  });

  it("reads a phase's lower bound while its total is unknown, and clamps a done past its total", () => {
    assert.equal(fractionOf(at("checking", 5, 0)), 0.2);
    assert.equal(fractionOf(at("movies", 5, 0)), 0);
    assert.equal(fractionOf(at("list", 9, 4)), 1);
    assert.equal(percentOf(at("checking", 2597, 2598)), 99);
  });
});

describe("the words", () => {
  it("names the phase and counts", () => {
    assert.equal(progressWords(at("checking", 1204, 2598)), "Checking streams 1,204 of 2,598");
    assert.equal(progressWords(at("movies", 12, 100)), "Walking movies 12 of 100 pages");
    assert.equal(progressWords(at("tv", 3, 100)), "Walking series 3 of 100 pages");
    assert.equal(progressWords(at("logos", 40, 312)), "Caching logos 40 of 312");
    assert.equal(progressWords(at("list", 2, 5)), "Walking titles 2 of 5 pages");
    assert.equal(progressWords(at("reading", 0, 0)), "Reading the playlist");
    assert.equal(progressWords(at("checking", 0, 0)), "Checking streams");
  });
});

describe("the job-progress slice", () => {
  it("keeps the most recently updated job last", () => {
    state().jobProgressUpdate(at("checking", 1, 10));
    state().jobProgressUpdate({ ...at("movies", 1, 10), jobId: 2 });
    state().jobProgressUpdate(at("checking", 2, 10));
    assert.deepEqual(ids(), [2, 1]);
  });

  it("never lets a job's fraction fall within a run, and forgets it when the run finishes", () => {
    state().jobProgressUpdate(at("checking", 5, 10));
    state().jobProgressUpdate(at("checking", 2, 10));
    assert.ok(Math.abs((state().jobProgress.live[0]?.fraction ?? 0) - 0.6) < 1e-12);
    state().jobProgressFinished(1);
    assert.deepEqual(ids(), []);
    state().jobProgressUpdate(at("reading", 0, 0));
    assert.equal(state().jobProgress.live[0]?.fraction, 0, "a new run starts again from the bottom");
  });

  it("takes a snapshot as the whole truth, keeping a surviving job's fraction", () => {
    state().jobProgressUpdate(at("checking", 5, 10));
    state().jobProgressUpdate({ ...at("movies", 1, 10), jobId: 2 });
    state().jobProgressSnapshot([at("checking", 1, 10)]);
    assert.deepEqual(ids(), [1]);
    assert.ok(Math.abs((state().jobProgress.live[0]?.fraction ?? 0) - 0.6) < 1e-12);
  });

  it("clears on a stream's end, and Refresh asks for a reopen by bumping a tick", () => {
    state().jobProgressUpdate(at("checking", 5, 10));
    state().jobProgressClear();
    assert.deepEqual(ids(), []);
    const before = state().jobEventsTick;
    state().jobEventsReopen();
    assert.equal(state().jobEventsTick, before + 1);
  });
});

describe("the stream's lifecycle decisions", () => {
  it("has a stream only while signed in with a token, and a new key on a new token, a Refresh or a focus", () => {
    assert.equal(streamKeyOf(false, "a", 0), null);
    assert.equal(streamKeyOf(true, null, 0), null);
    const keys = [streamKeyOf(true, "a", 0), streamKeyOf(true, "b", 0), streamKeyOf(true, "b", 1)];
    assert.equal(new Set(keys).size, 3);
    assert.equal(streamKeyOf(true, "a", 0), streamKeyOf(true, "a", 0));
  });

  it("forgets and marks the lists old when a stream ends by itself, and does neither when the app aborted it", () => {
    assert.deepEqual(streamEndPlan(false), { clear: true, stale: ["jobs", "playlists", "channels"] });
    assert.deepEqual(streamEndPlan(true), { clear: false, stale: [] });
  });
});

describe("a running job's row", () => {
  const job: AdminJob = {
    id: 1, name: "Sync", type: "playlist", enabled: true, schedule: "off", config: { playlistId: 3 }, running: true,
    createdAt: 1,
  };

  it("reads `running 46%` while its progress is known, with the data-st word still `running`", () => {
    const running = stateOfJob({ ...job, progress: at("checking", 1000, 2000) });
    assert.deepEqual([running.word, running.label], ["running", "running 60%"]);
    assert.equal(jobRow({ ...job, progress: at("logos", 92, 200) }).state.label, "running 9%");
  });

  it("reads plain `running` before any progress, and a stopped or idle row has no percent", () => {
    assert.deepEqual([stateOfJob(job).word, stateOfJob(job).label], ["running", undefined]);
    const stopped = stateOfJob({ ...job, running: false, lastRunAt: 5, lastResult: "stopped", progress: at("logos", 1, 2) });
    assert.deepEqual([stopped.word, stopped.label], ["stopped", undefined]);
  });
});
