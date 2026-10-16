import { randomUUID } from "node:crypto";

import { JOB_CONCURRENCY } from "../constants/media-files.js";
import { AppError } from "../lib/app-error.js";
import type { JobRepository } from "../store/job-repository.js";
import { SETTLED_JOB_STATES, type Job, type JobKind } from "../types/job.js";

/** What a runner receives; `request` holds the identifiers `enqueue` was given (never a path). */
export interface JobContext {
  jobId: string;
  kind: JobKind;
  request: { folderId: string } | { localFileId: string };
  /** Aborted on cancel and on shutdown; runners stop cooperatively and stay `cancelling` until then. */
  signal: AbortSignal;
  /** Clamped to 0..100; `null` reports indeterminate. */
  report: (percent: number | null) => void;
}

export type JobRunner = (context: JobContext) => Promise<void>;

/** A runner that throws an `AppError` has chosen a safe code and sentence for the job row. */
export interface JobService {
  register: (kind: JobKind, runner: JobRunner) => void;
  /** Persists a queued job and answers its id (3.9). */
  enqueue: (kind: JobKind, label: string, request: JobContext["request"]) => string;
  get: (jobId: string) => Job;
  /** Every job, newest first (`GET /api/jobs`). */
  list: () => Job[];
  /** Unsettled jobs and the recent settled ones (the state answer, section 4). */
  listRecent: () => Job[];
  /** Queued or running -> `cancelling` with the runner's signal aborted; answers 202's job (3.9). */
  cancel: (jobId: string) => Job;
  /** Settled only (3.9); answers the removed id. */
  dismiss: (jobId: string) => { removed: string };
  /** Start recovery: every left-behind queued/running/cancelling row is `interrupted`; none resumes. */
  atStart: () => void;
  /** Stops accepting work and abandons runners; the database keeps their rows for the next start. */
  close: () => Promise<void>;
}

const INTERRUPTED_ERROR = {
  code: "job.interrupted",
  message: "This job was interrupted when the app closed.",
} as const;

const notRunning = (job: Job): AppError | null =>
  job.state === "queued" || job.state === "running"
    ? null
    : new AppError("job.not_running", 409, "That job is not running.");

const percentOf = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

export function createJobService(deps: { repository: JobRepository; now: () => number }): JobService {
  const { repository, now } = deps;
  const runners = new Map<JobKind, JobRunner>();
  const controllers = new Map<string, AbortController>();
  const requests = new Map<string, JobContext["request"]>();
  const waiting: string[] = [];
  const active = new Map<string, Promise<void>>();
  let closed = false;

  const summaryOf = (jobId: string): Job => {
    const job = repository.find(jobId);
    if (!job) throw new AppError("job.not_found", 404, "That job no longer exists.");
    return job;
  };

  function settle(jobId: string, outcome: "done" | "failed" | "cancelled", error?: AppError): void {
    if (closed) return;
    repository.settle(jobId, {
      state: outcome,
      at: now(),
      ...(error !== undefined && { error: { code: error.code, message: error.message } }),
      ...(outcome === "done" && { percent: 100 }),
    });
    controllers.delete(jobId);
    requests.delete(jobId);
  }

  async function execute(jobId: string, kind: JobKind): Promise<void> {
    const controller = controllers.get(jobId);
    const runner = runners.get(kind);
    if (!controller || runner === undefined) return;
    const context = {
      jobId,
      kind,
      request: requests.get(jobId) ?? { folderId: jobId },
      signal: controller.signal,
      report(percent: number | null) {
        if (!closed && !controller.signal.aborted && percent !== null) repository.setPercent(jobId, percentOf(percent));
      },
    };
    try {
      await runner(context);
      settle(jobId, controller.signal.aborted ? "cancelled" : "done");
    } catch (error) {
      if (controller.signal.aborted) return settle(jobId, "cancelled");
      if (error instanceof AppError) return settle(jobId, "failed", error);
      settle(jobId, "failed", new AppError("internal.failure", 500, "This job failed unexpectedly."));
    }
  }

  function pump(): void {
    while (!closed && active.size < JOB_CONCURRENCY) {
      const jobId = waiting.shift();
      if (jobId === undefined) return;
      const job = repository.find(jobId);
      if (!job || job.state !== "queued") continue;
      repository.setRunning(jobId, now());
      const run = execute(jobId, job.kind).finally(() => {
        active.delete(jobId);
        pump();
      });
      active.set(jobId, run);
    }
  }

  return {
    register(kind, runner) {
      runners.set(kind, runner);
    },

    enqueue(kind, label, request) {
      if (closed) throw new AppError("store.failed", 503, "The app is shutting down.");
      const jobId = randomUUID();
      repository.insert({ id: jobId, kind, label, request, createdAt: now() });
      controllers.set(jobId, new AbortController());
      requests.set(jobId, request);
      waiting.push(jobId);
      queueMicrotask(pump);
      return jobId;
    },

    get: summaryOf,

    list: () => repository.list(),
    listRecent: () => repository.listRecent(),

    cancel(jobId) {
      const job = summaryOf(jobId);
      const refusal = notRunning(job);
      if (refusal !== null) throw refusal;
      repository.setCancelling(jobId);
      controllers.get(jobId)?.abort();
      const index = waiting.indexOf(jobId);
      if (index >= 0) {
        waiting.splice(index, 1);
        queueMicrotask(() => settle(jobId, "cancelled"));
      }
      return summaryOf(jobId);
    },

    dismiss(jobId) {
      const job = summaryOf(jobId);
      if (!SETTLED_JOB_STATES.includes(job.state)) {
        throw new AppError("job.not_settled", 409, "That job is still in progress.");
      }
      repository.remove(jobId);
      return { removed: jobId };
    },

    atStart() {
      repository.interruptUnfinished(now(), INTERRUPTED_ERROR);
    },

    async close() {
      closed = true;
      for (const controller of controllers.values()) controller.abort();
      await Promise.allSettled([...active.values()]);
    },
  };
}
