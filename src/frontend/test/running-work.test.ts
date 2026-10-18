import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { runningWorkView, trackedJob, videoPlayingOf } from "@/components/chrome/RunningWork";
import { useAppStore } from "@/store/app-store";
import type { ActivityFlags } from "@/store/slices/shell-slice";
import type { PlayerMediaState } from "@/types/player";
import type { Job } from "@/types/job";

const job = (over: Partial<Job> = {}): Job => ({
  id: "j-1", kind: "folder-scan", label: "Scanning Films", state: "running", percent: 40, createdAt: 1, ...over,
});
const QUIET: ActivityFlags = { library: false, video: false, live: false, search: false };

beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

describe("the running-work view", () => {
  it("is idle with nothing running: an empty bar, no readout, Stop disabled with nothing to stop", () => {
    const view = runningWorkView([], QUIET, false, false);
    assert.equal(view.active, false);
    assert.equal(view.percent, null);
    assert.equal(view.readout, undefined);
    assert.equal(view.tooltip, "Nothing running");
    assert.equal(view.stoppable, false);
    assert.equal(view.stopTitle, "Nothing to stop");
  });

  it("a live job wins over every activity flag and playback, determinate", () => {
    const view = runningWorkView([job()], { ...QUIET, search: true, library: true, video: true, live: true }, true, true);
    assert.equal(view.active, true);
    assert.equal(view.percent, 40);
    assert.equal(view.readout, "1 running · 40%");
    assert.equal(view.tooltip, "Scanning Films · 40%");
    assert.equal(view.stoppable, true);
    assert.equal(view.stopTitle, "Stop scanning films");
  });

  it("a job that cannot say how far it is fills and pulses (percent null)", () => {
    const view = runningWorkView([job({ percent: undefined })], QUIET, false, false);
    assert.equal(view.active, true);
    assert.equal(view.percent, null);
    assert.equal(view.readout, "1 running");
    assert.equal(view.tooltip, "Scanning Films");
  });

  it("while the tracked job is cancelling the readout says stopping, Stop still armed", () => {
    const view = runningWorkView([job({ state: "cancelling" })], QUIET, false, false);
    assert.equal(view.readout, "stopping");
    assert.equal(view.active, true);
    assert.equal(view.stoppable, true, "a cancelling job is still a live one, as today's cancel flow");
  });

  it("the percent is clamped into 0 to 100 and the count covers every live job", () => {
    assert.equal(runningWorkView([job({ percent: 140 })], QUIET, false, false).percent, 100);
    assert.equal(runningWorkView([job({ percent: -5 })], QUIET, false, false).percent, 0);
    const two = runningWorkView([job({ id: "a" }), job({ id: "b", state: "done" }), job({ id: "c" })], QUIET, false, false);
    assert.equal(two.readout, "2 running · 40%");
  });

  it("without a job the priority is search, then library, then video, then live", () => {
    const all: ActivityFlags = { search: true, library: true, video: true, live: true };
    assert.equal(runningWorkView([], all, false, false).readout, "Searching titles");
    assert.equal(runningWorkView([], { ...all, search: false }, false, false).readout, "Loading library");
    assert.equal(runningWorkView([], { ...all, search: false, library: false }, false, false).readout, "Loading video");
    assert.equal(
      runningWorkView([], { ...all, search: false, library: false, video: false }, false, false).readout,
      "Starting stream",
    );
  });

  it("each activity is indeterminate: the bar fills and pulses", () => {
    for (const flag of ["search", "library", "video", "live"] as const) {
      const view = runningWorkView([], { ...QUIET, [flag]: true }, false, false);
      assert.equal(view.active, true, flag);
      assert.equal(view.percent, null, flag);
    }
  });

  it("playing media never fills the bar; it only arms Stop as Stop playback", () => {
    const video = runningWorkView([], QUIET, true, false);
    assert.equal(video.active, false);
    assert.equal(video.readout, undefined);
    assert.equal(video.stoppable, true);
    assert.equal(video.stopTitle, "Stop playback");
    const live = runningWorkView([], QUIET, false, true);
    assert.equal(live.stoppable, true);
    assert.equal(live.stopTitle, "Stop playback");
    assert.equal(runningWorkView([], QUIET, false, false).stopTitle, "Nothing to stop");
  });
});

describe("the tracked job", () => {
  it("is the first live one; settled jobs are skipped", () => {
    assert.equal(trackedJob([job({ id: "a" }), job({ id: "b" })])?.id, "a");
    assert.equal(trackedJob([job({ id: "a", state: "done" }), job({ id: "b", state: "queued" })])?.id, "b");
    assert.equal(trackedJob([job({ id: "a", state: "failed" }), job({ id: "b", state: "cancelled" })]), null);
    assert.equal(trackedJob([]), null);
  });
});

describe("the playback playing gate", () => {
  const hosted: PlayerMediaState = {
    sources: [{ id: "app", kind: "stream", name: "App player", url: "https://media.test/a.m3u8" }],
    activeSourceId: "app",
    stage: { kind: "ready" },
  };

  it("arms while the hosted media plays - even while its stage kind still reads loading", () => {
    assert.equal(videoPlayingOf(hosted, false), true);
    assert.equal(videoPlayingOf({ ...hosted, stage: { kind: "loading" } }, false), true,
      "starting counts, as the live stage's does: the kind only advances on a media event");
  });

  it("disarms on pause, failure, closing and an unhosted stage", () => {
    assert.equal(videoPlayingOf(hosted, true), false, "paused");
    assert.equal(videoPlayingOf({ ...hosted, stage: { kind: "failed", reason: "Dead." } }, false), false);
    assert.equal(videoPlayingOf({ ...hosted, stage: { kind: "idle" } }, false), false);
    assert.equal(videoPlayingOf({ ...hosted, sources: [] }, false), false);
    assert.equal(videoPlayingOf({ sources: [], activeSourceId: null, stage: { kind: "idle" } }, false), false,
      "nothing open: nothing to stop");
  });
});

describe("activity in the store", () => {
  it("starts all quiet, and setActivity flips one area and leaves the others", () => {
    const state = () => useAppStore.getState();
    assert.deepEqual({ ...state().activity }, { ...QUIET });
    state().setActivity("library", true);
    assert.deepEqual({ ...state().activity }, { ...QUIET, library: true });
    state().setActivity("search", true);
    state().setActivity("library", false);
    assert.deepEqual({ ...state().activity }, { ...QUIET, search: true });
  });

  it("is transient session state: the hydration snapshot never writes or clears it", () => {
    const state = () => useAppStore.getState();
    state().setActivity("video", true);
    state().applySnapshot({ unreadable: [] });
    assert.deepEqual({ ...state().activity }, { ...QUIET, video: true });
  });
});
