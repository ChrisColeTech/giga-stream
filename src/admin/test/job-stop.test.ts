import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createElement } from "react";
import { ApiError } from "@giga/http/api-error";
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
  it("posts to /api/admin/jobs/:id/stop with no body and reads the 202 as the job, still running", async () => {
    await withBackend(
      () => success({ ...job(3), running: true }, 202),
      async (calls) => {
        const answer = await jobs.stop(3);
        assert.deepEqual([calls[0]?.method, calls[0]?.url, calls[0]?.body], ["POST", "/api/admin/jobs/3/stop", undefined]);
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

describe("Stop behavior and the Jobs strip", () => {
  it("keeps Stop out of the strip; Enable, Disable and Delete remain, and Run job is the page promote", () => {
    assert.deepEqual(JOB_BULK_ORDER, ["enable", "disable", "delete"]);
    const html = page();
    const table = html.slice(html.indexOf('aria-label="Jobs table"'));
    assert.ok(!table.includes(">Stop<") && !table.includes("lucide-circle-stop"));
    assert.ok(table.indexOf("Enable</button>") < table.indexOf("Disable</button>"));
    assert.ok(table.indexOf("Disable</button>") < table.indexOf(">Delete</button>"));
    assert.ok(!table.includes("Run job"), "Run job stays out of the strip");
    assert.ok(html.slice(0, html.indexOf("overflow-y-auto")).includes('aria-label="Run job. Tick a job first"'), "the promote");
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

describe("the workspace Run verb in the toolbar", () => {
  const barOf = (html: string): string => html.slice(html.indexOf('role="toolbar"'), html.indexOf('id="jw-details"'));
  const before = (html: string, words: readonly string[]): boolean =>
    words.every((word, index) => index === 0 || html.indexOf(words[index - 1] ?? "") < html.indexOf(word));
  const openJob = (): void => {
    state().jobsPlaylistsLoaded([playlist(1)]);
    state().jobsLoaded([job(1)]);
    state().openWorkspace("jobs", "1");
  };
  it("gates Run job and Stop as opposites: Running. / Not running.", () => {
    assert.equal(workspaceRunReason(job(2, { running: true }), IDLE), "Running.");
    assert.equal(workspaceRunReason(job(1), IDLE), undefined);
    assert.equal(workspaceStopReason(job(2, { running: true }), false), undefined);
    assert.equal(workspaceStopReason(job(1), false), "Not running.");
    assert.equal(workspaceStopReason(job(2, { running: true }), true), "Stopping.");
  });

  it("draws Discard left; Save, then the primary Run job rightmost; no Stop, no forward verb", () => {
    openJob();
    const bar = barOf(page());
    assert.ok(/<button[^>]*title="Start the job now[^>]*>Run job<\/button>/.test(bar) && bar.includes('aria-label="Save. Nothing has changed."'));
    assert.ok(before(bar, ["Discard changes", "min-w-0 flex-1", ">Save<", ">Run job<"]), "Discard left; Save, then Run job rightmost");
    assert.ok(!bar.includes("Stop") && !bar.includes("→"), "Stop is the statusbar's; Run job is the promote");
    state().jobsLoaded([job(1, { running: true })]);
    assert.ok(barOf(page()).includes('aria-label="Run job. Running."'));
  });

  it("reads Resume after a stop, and Run job again once it has run", () => {
    openJob();
    state().jobsLoaded([job(1, { lastRunAt: 5, lastResult: "stopped", lastCounts: counts({ stopped: true }) })]);
    const html = page();
    assert.ok(barOf(html).includes(">Resume</button>") && !barOf(html).includes(">Run job</button>"));
    assert.ok(html.includes("Stopped: nothing changed."));
    state().jobsLoaded([job(1, { lastRunAt: 9, lastResult: "ok", lastCounts: counts() })]);
    assert.ok(barOf(page()).includes(">Run job</button>"));
  });
});
