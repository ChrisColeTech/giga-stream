import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { ApiError } from "@giga/http/api-error";
import { BULK_ICONS } from "@/constants/bulk-icons";
import { BULK_TIPS } from "@/constants/bulk-tips";
import { bulkNotes } from "@/lib/bulk-plan";
import { JOB_BULK_ORDER, JOB_BULK_WORDS, jobVerbReason, planJobBulk } from "@/lib/job-bulk";
import { stateOfJob } from "@/lib/job-rows";
import { workspaceRunReason, workspaceStopReason } from "@/lib/job-run-gate";
import { runWords } from "@/lib/run-words";
import { JobsPage } from "@/pages/JobsPage";
import { createBulkRunner } from "@/services/bulk-run";
import { createJobFlows } from "@/services/job-flows";
import { jobs, type JobsService } from "@/services/jobs";
import type { AdminJob } from "@/services/schemas/job-schema";
import { useAppStore } from "@/store/app-store";
import { json, success } from "./support/fake-backend";
import { withBackend } from "./support/global-fetch";
import { catalogJob, counts, playlist, playlistJob } from "./support/run-kit";
import { renderLive, resetStore, signInForTest } from "./support/store";

const state = () => useAppStore.getState();
const job = (id: number, extra: Partial<AdminJob> = {}): AdminJob => playlistJob(id, 1, { name: `Job ${id}`, ...extra });
const ITEMS = [job(1), job(2, { running: true }), catalogJob(3, { running: true }), job(4, { lastRunAt: 5, lastResult: "stopped" })];
const context = (ticked: number[], busy = false) => ({ items: ITEMS, ticked, playlists: [], busy, unreachable: false });
const page = (): string => renderLive(createElement(JobsPage, { active: true }));
const IDLE = { dirty: false, busy: false, unreachable: false, playlists: [] };

function flowsWith(stop: JobsService["stop"], reloaded: { count: number } = { count: 0 }) {
  const service: JobsService = {
    list: async () => {
      reloaded.count += 1;
      return { items: ITEMS, unreadable: 0 };
    },
    create: async () => job(9),
    update: async (id) => job(id),
    remove: async (id) => ({ id }),
    run: async (id) => job(id, { running: true }),
    stop,
  };
  return createJobFlows({
    service,
    playlists: { list: async () => ({ items: [], unreadable: 0 }) },
    store: () => state(),
    audit: { reload: async () => undefined },
  });
}

beforeEach(() => {
  resetStore();
  signInForTest();
});

describe("the jobs service stops", () => {
  it("posts to /api/jobs/:id/stop with no body and reads the 202 as the job, still running", async () => {
    await withBackend(
      () => success({ ...job(3), running: true }, 202),
      async (calls) => {
        const answer = await jobs.stop(3);
        assert.deepEqual([calls[0]?.method, calls[0]?.url, calls[0]?.body], ["POST", "/api/jobs/3/stop", undefined]);
        assert.equal(answer.running, true);
      },
    );
  });

  it("carries a refusal as the backend said it: job.not_running, and a catalog job's 422 before it can be stopped", async () => {
    const cases = [[409, "job.not_running", "That job is not running."], [422, "job.invalid", "A catalog sync cannot be stopped."]] as const;
    for (const [status, code, message] of cases) {
      await withBackend(
        () => json({ ok: false, error: { code, message } }, status),
        async () => assert.rejects(jobs.stop(3), { code, status, message }),
      );
    }
  });
});

describe("the Stop verb on the Jobs strip", () => {
  it("is drawn after Run job with the CircleStop icon and a tooltip at rest", () => {
    assert.deepEqual(JOB_BULK_ORDER, ["run", "stop", "enable", "disable", "delete"]);
    assert.ok(BULK_ICONS.stop !== undefined);
    assert.ok(BULK_TIPS.stop.length > 0 && !BULK_TIPS.stop.endsWith("."));
    const html = page();
    assert.ok(html.includes('aria-label="Stop. Tick a job first"'), "always drawn, disabled until a job is ticked");
    assert.ok(html.includes("lucide-circle-stop"));
    assert.ok(html.indexOf('aria-label="Run job.') < html.indexOf('aria-label="Stop.'));
  });

  it("acts on the ticked jobs that run; a job that does not is skipped with `That job is not running.`", () => {
    const plan = planJobBulk("stop", ITEMS, [1, 2, 3, 4]);
    assert.deepEqual(plan.runnable.map((item) => item.id), [2, 3]);
    assert.deepEqual(plan.refused.map((item) => [item.id, item.reason]), [[1, "That job is not running."], [4, "That job is not running."]]);
  });

  it("is disabled with Tick a job first, then That job is not running., and a running catalog job is NOT disabled", () => {
    const reason = (ticked: number[], busy = false) => jobVerbReason("stop", planJobBulk("stop", ITEMS, ticked), context(ticked, busy));
    assert.equal(reason([]), "Tick a job first");
    assert.equal(reason([1]), "That job is not running.");
    assert.equal(reason([1, 4]), "That job is not running.");
    assert.equal(reason([2]), undefined);
    assert.equal(reason([3]), undefined, "the backend accepts a catalog stop; the UI does not forbid it");
    assert.equal(reason([2], true), "Working.");
  });

  it("runs through the shared runner: a refusal on one is reported, the rest stop, one summary", async () => {
    state().jobsLoaded(ITEMS);
    const asked: number[] = [];
    const flows = flowsWith(async (id) => {
      asked.push(id);
      if (id === 3) throw new ApiError("job.invalid", "A catalog sync cannot be stopped.", 422);
      return job(id, { running: true });
    });
    const outcome = await createBulkRunner(() => state()).run({
      words: JOB_BULK_WORDS.stop,
      area: "Job",
      plan: planJobBulk("stop", ITEMS, [1, 2, 3]),
      perform: flows.bulkCall("stop"),
      finish: () => undefined,
      reread: async () => undefined,
    });
    assert.deepEqual(asked, [2, 3]);
    assert.deepEqual(bulkNotes(outcome ?? { done: [], failed: [], refused: [] }).map((note) => note.sentence), [
      "A catalog sync cannot be stopped.",
      "That job is not running.",
    ]);
    assert.equal(state().notice?.sentence, "Stopped 1 job; 1 failed; 1 skipped.");
  });
});

describe("the Stop flow", () => {
  it("says `Stopping <name>.`, keeps the job running until a Refresh reads the result, and never polls", async () => {
    state().jobsLoaded(ITEMS);
    const flows = flowsWith(async (id) => job(id, { running: true }));
    const result = await flows.stop(2);
    assert.equal(result.ok, true);
    assert.equal(state().events.at(-1)?.sentence, "Stopping Job 2.");
    assert.equal(state().jobs.items.find((item) => item.id === 2)?.running, true);
  });

  it("says the backend's sentence when it refuses, and reads the list again (the run may just have ended)", async () => {
    state().jobsLoaded(ITEMS);
    const reloaded = { count: 0 };
    const flows = flowsWith(async () => {
      throw new ApiError("job.not_running", "That job is not running.", 409);
    }, reloaded);
    const result = await flows.stop(2);
    assert.deepEqual([result.ok, !result.ok && result.sentence], [false, "That job is not running."]);
    assert.equal(state().notice?.sentence, "That job is not running.");
    assert.equal(state().notice?.tone, "warn");
    assert.equal(reloaded.count, 1);
  });

  it("ignores a second press while the first is in flight, and a gone job closes with its notice", async () => {
    state().jobsLoaded(ITEMS);
    let calls = 0;
    let release: () => void = () => undefined;
    const flows = flowsWith(async (id) => {
      calls += 1;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return job(id, { running: true });
    });
    const first = flows.stop(2);
    await flows.stop(2);
    release();
    await first;
    assert.equal(calls, 1);
    assert.equal((await flows.stop(99)).ok, false);
    assert.equal(state().notice?.sentence, "That job no longer exists.");
  });
});

describe("a stopped run in the words", () => {
  it("reads `stopped` on the row, faint, when the last run was stopped and nothing runs", () => {
    const stopped = stateOfJob(job(4, { lastRunAt: 5, lastResult: "stopped" }));
    assert.deepEqual([stopped.word, stopped.tone, stopped.dimmed], ["stopped", "faint", false]);
    assert.equal(stateOfJob(job(4, { lastRunAt: 5, lastResult: "stopped", running: true })).word, "running");
    assert.equal(stateOfJob(job(4, { lastRunAt: 5, lastResult: "stopped", enabled: false })).word, "disabled");
    assert.equal(stateOfJob(job(4, { lastRunAt: 5, lastResult: "failed" })).word, "failed");
    assert.equal(stateOfJob(job(4, { lastResult: "stopped" })).word, "idle", "a job that never ran has not stopped");
  });

  it("words every count of a sync, and a stopped run with its partial counts", () => {
    const full = counts({
      created: 2, updated: 1, skipped: 3, refused: 4, logosCached: 312, logosFailed: 7, online: 1904, offline: 640, unchecked: 55,
    });
    assert.equal(
      runWords("ok", full),
      "Synced: 2 created, 1 updated, 3 skipped, 4 refused, 312 logos cached, 7 logos failed, 1,904 online, 640 offline, 55 not checked.",
    );
    assert.equal(runWords("stopped", counts({ logosCached: 40, unchecked: 2598, stopped: true })), "Stopped: 40 logos cached, 2,598 not checked.");
    assert.equal(runWords("ok", counts({ online: 1, stopped: true })), "Stopped: 1 online.", "the typed flag alone says it");
    assert.equal(runWords("stopped", { titles: 12, stale: 0, stopped: true }), "Stopped: 12 titles.");
  });
});

describe("the workspace Run group", () => {
  it("gates Run job and Stop as opposites: Running. / Not running.", () => {
    assert.equal(workspaceRunReason(job(2, { running: true }), IDLE), "Running.");
    assert.equal(workspaceRunReason(job(1), IDLE), undefined);
    assert.equal(workspaceStopReason(job(2, { running: true }), false), undefined);
    assert.equal(workspaceStopReason(job(1), false), "Not running.");
    assert.equal(workspaceStopReason(job(2, { running: true }), true), "Stopping.");
  });

  it("draws a ghost Stop beside Run job, disabled `Not running.` while idle and `Running.` on Run job while it runs", () => {
    state().jobsPlaylistsLoaded([playlist(1)]);
    state().jobsLoaded([job(1)]);
    state().openWorkspace("jobs", "1");
    const idle = page();
    assert.ok(idle.includes(">Run job</button>") && idle.includes('aria-label="Stop. Not running."'));
    assert.ok(idle.indexOf(">Run job<") < idle.indexOf('aria-label="Stop. Not running."'));
    state().jobsLoaded([job(1, { running: true })]);
    const running = page();
    assert.ok(running.includes('aria-label="Run job. Running."') && running.includes(">Stop</button>"));
  });

  it("reads Resume after a stop, and Run job again once it has run", () => {
    state().jobsPlaylistsLoaded([playlist(1)]);
    state().jobsLoaded([job(1, { lastRunAt: 5, lastResult: "stopped", lastCounts: counts({ stopped: true }) })]);
    state().openWorkspace("jobs", "1");
    const html = page();
    assert.ok(html.includes(">Resume</button>") && !html.includes(">Run job</button>"));
    assert.ok(html.includes("Stopped: nothing changed."));
    state().jobsLoaded([job(1, { lastRunAt: 9, lastResult: "ok", lastCounts: counts() })]);
    assert.ok(page().includes(">Run job</button>"));
  });
});
