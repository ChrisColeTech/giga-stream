import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { STOP_BUILD, STOP_IDLE, STOP_SYNCING } from "@/constants/record-copy";
import { withProgress, type LiveJob } from "@/lib/live-jobs";
import { workView } from "@/lib/running-work";
import { useAppStore } from "@/store/app-store";
import { NO_WORK } from "@/store/work-slice";

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

const live = (...parts: Array<[number, string, number, number]>): readonly LiveJob[] =>
  parts.reduce<readonly LiveJob[]>((all, [jobId, phase, done, total]) => withProgress(all, { jobId, phase, done, total }), []);

describe("the statusbar's running work", () => {
  it("is idle with an empty track and Stop disabled with `Nothing is running.`", () => {
    const view = workView(NO_WORK, []);
    assert.deepEqual(view, {
      active: false, percent: null, readout: undefined, tooltip: STOP_IDLE, stoppable: false, stopText: STOP_IDLE,
    });
    assert.equal(STOP_IDLE, "Nothing is running.");
  });

  it("counts channels preparing over a bar whose progress is unknown, and Stop says why it cannot stop them", () => {
    const view = workView({ preparing: 2 }, []);
    assert.deepEqual([view.readout, view.percent, view.active], ["2 preparing", null, true]);
    assert.deepEqual([view.stoppable, view.stopText], [false, STOP_BUILD]);
  });

  it("counts the live jobs, fills to the most recently updated one and names its phase and counts", () => {
    const view = workView(NO_WORK, live([1, "movies", 50, 100], [2, "checking", 1204, 2598]));
    assert.equal(view.readout, "2 syncing");
    assert.equal(view.percent, 57);
    assert.equal(view.tooltip, "Checking streams 1,204 of 2,598 · 57%");
    assert.deepEqual([view.stoppable, view.stopText], [true, STOP_SYNCING]);
    assert.equal(workView(NO_WORK, live([2, "checking", 1, 10], [1, "tv", 50, 100])).percent, 75);
  });

  it("joins both with a middle dot; a job running makes Stop available", () => {
    const view = workView({ preparing: 2 }, live([1, "logos", 40, 312]));
    assert.equal(view.readout, "2 preparing · 1 syncing");
    assert.equal(view.stoppable, true);
  });

  it("never reads work.syncing: a bulk runner's count is not a running job", () => {
    useAppStore.getState().setWork({ syncing: 4 });
    const view = workView(useAppStore.getState().work, []);
    assert.deepEqual([view.active, view.readout, view.stoppable], [false, undefined, false]);
  });
});

describe("the work slice", () => {
  it("starts at nothing and merges a patch", () => {
    assert.deepEqual(useAppStore.getState().work, NO_WORK);
    useAppStore.getState().setWork({ preparing: 3 });
    useAppStore.getState().setWork({ syncing: 1 });
    assert.deepEqual(useAppStore.getState().work, { preparing: 3, syncing: 1 });
  });
});
