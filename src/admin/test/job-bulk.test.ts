import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "@giga/http/api-error";
import { bulkNotes } from "@/lib/bulk-plan";
import { JOB_BULK_WORDS, jobVerbReason, planJobBulk } from "@/lib/job-bulk";
import { createBulkRunner } from "@/services/bulk-run";
import { createJobFlows } from "@/services/job-flows";
import type { JobsService } from "@/services/jobs";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { counts, catalogJob, playlistJob } from "./support/run-kit";
import { resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob =>
  playlistJob(id, 1, { name: `Job ${id}`, schedule: "off", ...extra });
const catalog = (id: number, extra: Partial<AdminJob> = {}): AdminJob => catalogJob(id, { name: `Job ${id}`, ...extra });
const ITEMS = [job(1), job(2, { enabled: false }), job(3, { running: true }), job(4), catalog(5), catalog(6, { running: true })];
const context = (ticked: number[], busy = false) => ({ items: ITEMS, ticked, playlists: [], busy, unreachable: false });

function service(run: JobsService["run"]): JobsService {
  return {
    list: async () => ({ items: [], unreadable: 0 }),
    create: async () => job(9),
    update: async (id, patch) => job(id, { enabled: patch["enabled"] === true }),
    remove: async (id) => ({ id }),
    run,
  };
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the Jobs bulk verbs", () => {
  it("Enable and Disable skip a job already so; Delete skips a running job and a playlist's job; Run job skips nothing", () => {
    const reasons = (verb: "enable" | "disable" | "delete" | "run", ticked = [1, 2, 3]) =>
      planJobBulk(verb, ITEMS, ticked).refused.map((item) => [item.id, item.reason]);
    assert.deepEqual(reasons("enable"), [[1, "Already enabled."], [3, "Already enabled."]]);
    assert.deepEqual(reasons("disable"), [[2, "Already disabled."]]);
    const owned = "A playlist's job goes with the playlist.";
    assert.deepEqual(reasons("delete"), [[1, owned], [2, owned], [3, owned]], "a playlist's job is never deleted through /api/jobs");
    assert.deepEqual(reasons("delete", [5, 6]), [[6, "A running job cannot be deleted."]]);
    assert.deepEqual(reasons("run"), []);
  });

  it("are disabled with Tick a job first, then the gate for Run job, then why nothing is left", () => {
    for (const verb of ["run", "enable", "disable", "delete"] as const) {
      assert.equal(jobVerbReason(verb, planJobBulk(verb, ITEMS, []), context([])), "Tick a job first");
    }
    const reason = (verb: "run" | "enable" | "disable" | "delete", ticked: number[], busy = false) =>
      jobVerbReason(verb, planJobBulk(verb, ITEMS, ticked), context(ticked, busy));
    assert.equal(reason("run", [1, 2]), "Jobs that are disabled cannot run.");
    assert.equal(reason("enable", [1, 4]), "Every ticked job is already enabled.");
    assert.equal(reason("disable", [2]), "Every ticked job is already disabled.");
    assert.equal(reason("delete", [3]), "A playlist's job goes with the playlist.");
    assert.equal(reason("delete", [6]), "A running job cannot be deleted.");
    assert.equal(reason("delete", [5]), undefined);
    assert.equal(reason("delete", [1, 3], true), "Working.");
    assert.equal(reason("run", [1, 4]), undefined);
  });
});

describe("Run job through the shared runner", () => {
  it("runs two ticked jobs one after another; a refusal on one is reported and the rest continue", async () => {
    state().jobsLoaded([job(1), job(4)]);
    const order: number[] = [];
    const flows = createJobFlows({
      service: service(async (id) => {
        order.push(id);
        if (id === 1) throw new ApiError("sync.busy", "A playlist sync is already running.", 409);
        return job(id, { running: true, lastRunAt: 9, lastResult: "ok", lastCounts: counts({ created: 1 }) });
      }),
      playlists: { list: async () => ({ items: [], unreadable: 0 }) },
      store: () => state(),
      audit: { reload: async () => undefined },
    });
    const runner = createBulkRunner(() => state());
    const outcome = await runner.run({
      words: JOB_BULK_WORDS.run,
      area: "Job",
      plan: planJobBulk("run", state().jobs.items, [1, 4]),
      perform: flows.bulkCall("run"),
      finish: () => undefined,
      reread: async () => undefined,
    });
    assert.deepEqual(order, [1, 4]);
    assert.deepEqual(outcome?.done.map((item) => item.id), [4]);
    assert.deepEqual(bulkNotes(outcome ?? { done: [], failed: [], refused: [] }), [
      { id: "1", label: "Job 1", sentence: "A playlist sync is already running." },
    ]);
    assert.equal(state().notice?.sentence, "Ran 1 job; 1 failed.");
    assert.equal(state().jobs.items.find((item) => item.id === 4)?.lastRunAt, 9);
    assert.equal(state().jobs.items.find((item) => item.id === 4)?.running, true, "started, not awaited: it answers running");
  });

  it("stops at the next job when the session changes under the run, and says nothing", async () => {
    state().jobsLoaded([job(1), job(4)]);
    const order: number[] = [];
    const flows = createJobFlows({
      service: service(async (id) => {
        order.push(id);
        state().signOut();
        return job(id);
      }),
      playlists: { list: async () => ({ items: [], unreadable: 0 }) },
      store: () => state(),
      audit: { reload: async () => undefined },
    });
    const outcome = await createBulkRunner(() => state()).run({
      words: JOB_BULK_WORDS.run,
      area: "Job",
      plan: planJobBulk("run", state().jobs.items, [1, 4]),
      perform: flows.bulkCall("run"),
      finish: () => undefined,
      reread: async () => undefined,
    });
    assert.deepEqual([order, outcome], [[1], null]);
  });
});
