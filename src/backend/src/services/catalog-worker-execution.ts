import { AppError } from "../constants/errors.js";
import type { CatalogWorkerRuntime, WorkerLog } from "../types/catalog-worker.js";

/** One operational run. Single-flight is process-local; operators must exclude overlapping Cloud Run executions. */
export async function executeCatalogWorker(deps: {
  jobId?: number;
  tmdbToken: string;
  signal: AbortSignal;
  open: () => Promise<CatalogWorkerRuntime>;
  log: WorkerLog;
}): Promise<number> {
  const { jobId, signal, log } = deps;
  if (jobId === undefined || !Number.isSafeInteger(jobId) || jobId <= 0) {
    log({ event: "refused", code: "worker.invalid_job_id" });
    return 1;
  }
  if (!deps.tmdbToken.trim()) {
    log({ event: "refused", jobId, code: "worker.missing_tmdb_token" });
    return 1;
  }
  let runtime: CatalogWorkerRuntime | undefined;
  let unsubscribe: (() => void) | undefined;
  let exitCode = 1;
  const abort = (): void => {
    log({ event: "stopping", jobId });
    runtime?.runner.abort(jobId);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) return 1;
    runtime = await deps.open();
    const job = await runtime.jobs.find(jobId);
    if (job?.type !== "catalog") {
      log({ event: "refused", jobId, code: job === undefined ? "job.not_found" : "worker.not_catalog" });
    } else if (!signal.aborted) {
      unsubscribe = runtime.progress.subscribe((event) => {
        if (event.type === "progress") {
          const { phase, done, total } = event.progress;
          log({ event: "progress", jobId, phase, done, total });
        }
      });
      log({ event: "starting", jobId });
      await runtime.runner.run(job, {}, "system");
      // A signal can arrive while run() is awaiting its refusal check, before the flight exists.
      if (signal.aborted) runtime.runner.abort(jobId);
      const ended = await runtime.runner.wait(jobId);
      const counts: Record<string, number> = {};
      for (const [key, value] of Object.entries(ended?.lastCounts ?? {})) {
        if (typeof value === "number") counts[key] = value;
      }
      log({ event: "finished", jobId, outcome: ended?.lastResult ?? "missing", ...counts });
      if (ended?.lastResult === "ok" && ended.lastRunAt !== undefined && !signal.aborted) exitCode = 0;
    }
  } catch (error) {
    // Never log exception text, config, URLs or credentials.
    log({ event: "failed", jobId, code: error instanceof AppError ? error.code : "worker.failed" });
  } finally {
    try {
      // No timeout: keep the store open until cancellation and final persistence actually settle.
      await runtime?.runner.shutdown();
    } catch {
      exitCode = 1;
      log({ event: "failed", jobId, code: "worker.shutdown_failed" });
    } finally {
      unsubscribe?.();
      try { await runtime?.close(); } catch {
        exitCode = 1;
        log({ event: "failed", jobId, code: "worker.close_failed" });
      }
      signal.removeEventListener("abort", abort);
    }
  }
  return signal.aborted ? 1 : exitCode;
}
