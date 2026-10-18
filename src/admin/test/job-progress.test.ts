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

  it("weights the Library fill like the backend: walk 0-10% (a half per kind), details 10-100%, no episodes phase", () => {
    assert.equal(fractionOf(at("movies", 50, 100)), 0.025);
    assert.equal(fractionOf(at("movies", 100, 100)), 0.05);
    assert.equal(fractionOf(at("tv", 0, 100)), 0.05);
    assert.equal(fractionOf(at("tv", 100, 100)), 0.1);
    assert.equal(fractionOf(at("details", 0, 10923)), 0.1);
    assert.ok(Math.abs(fractionOf(at("details", 5000, 10000)) - 0.55) < 1e-12);
    assert.equal(fractionOf(at("details", 10923, 10923)), 1);
    assert.equal(fractionOf(at("details", 5, 0)), 0.1);
    assert.equal(percentOf(at("details", 5000, 10000)), 55);
  });

  it("gives any other scope (one catalog list) the whole bar", () => {
    assert.equal(fractionOf(at("list", 3, 4)), 0.75);
  });

  it("never goes backwards across the Library fill's phases", () => {
    const steps = [at("movies", 100, 100), at("tv", 0, 100), at("tv", 100, 100), at("details", 0, 50), at("details", 50, 50)];
    const values = steps.map(fractionOf);
    assert.deepEqual([...values].sort((a, b) => a - b), values);
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
    assert.equal(progressWords(at("movies", 12, 130)), "Walking movies, year 12 of 130");
    assert.equal(progressWords(at("tv", 3, 131)), "Walking series, year 3 of 131");
    assert.equal(progressWords(at("details", 1204, 10923)), "Fetching details 1,204 of 10,923");
    assert.equal(progressWords(at("details", 0, 0)), "Fetching details");
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
