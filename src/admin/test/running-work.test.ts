import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { STOP_BUILD, STOP_IDLE, STOP_SYNC } from "@/constants/record-copy";
import { workView } from "@/lib/running-work";
import { useAppStore } from "@/store/app-store";
import { NO_WORK } from "@/store/work-slice";

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe("the statusbar's running work", () => {
  it("is idle with an empty track and Stop disabled with `Nothing to stop`", () => {
    const view = workView(NO_WORK);
    assert.deepEqual(view, { running: null, liveCount: 0, readout: undefined, stopReason: STOP_IDLE });
    assert.equal(STOP_IDLE, "Nothing to stop");
  });

  it("counts channels preparing over a bar whose progress is unknown", () => {
    const view = workView({ preparing: 2, syncing: 0 });
    assert.equal(view.readout, "2 preparing");
    assert.deepEqual(view.running, { label: "2 preparing", percent: null });
    assert.equal(view.liveCount, 2);
    assert.equal(view.stopReason, STOP_BUILD);
  });

  it("counts syncs", () => {
    const view = workView({ preparing: 0, syncing: 1 });
    assert.equal(view.readout, "1 syncing");
    assert.equal(view.stopReason, STOP_SYNC);
  });

  it("joins both with a middle dot, and a build's reason wins", () => {
    const view = workView({ preparing: 2, syncing: 1 });
    assert.equal(view.readout, "2 preparing · 1 syncing");
    assert.equal(view.liveCount, 3);
    assert.equal(view.stopReason, STOP_BUILD);
  });

  it("never offers Stop: every view has a reason", () => {
    for (const work of [NO_WORK, { preparing: 1, syncing: 0 }, { preparing: 0, syncing: 4 }]) {
      assert.ok(workView(work).stopReason.length > 0);
    }
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
