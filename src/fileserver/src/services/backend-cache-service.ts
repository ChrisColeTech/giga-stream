import type { CacheStateRepository } from "../store/cache-state-repository.js";
import {
  CACHE_DATASETS,
  type CacheDataset,
  type CacheStateRow,
  type DatasetSync,
  type SyncOutcome,
} from "../types/backend-cache.js";
import { badResponse, unreachable } from "./admin-failure.js";
import { isDue, sourceKeyOf } from "./cache-freshness.js";

interface Run {
  done: Promise<SyncOutcome>;
  controller: AbortController;
}

/**
 * The backend cache (docs/46 sections B and C; docs/03 section 5): decides when a dataset is synced and runs
 * its sync, one at a time per dataset. No timer: a dataset is checked at launch (`start`) and when a page reads
 * it (`ensureFresh`). A warm, due dataset is refreshed in the background while the cache answers; a cold one is
 * awaited once. `refresh` forces a sync and joins a run in flight.
 */
export function createBackendCacheService(deps: {
  state: CacheStateRepository;
  syncs: Partial<Record<CacheDataset, DatasetSync>>;
  adminUrl: () => string;
  now: () => number;
}) {
  const { state, syncs, adminUrl, now } = deps;
  const running = new Map<CacheDataset, Run>();
  let closed = false;

  /** A different backend than the cache was filled from: stop its syncs and drop everything it left. */
  function currentRow(dataset: CacheDataset, sourceKey: string): CacheStateRow | undefined {
    const foreign = CACHE_DATASETS.some((name) => {
      const row = state.get(name);
      return row !== undefined && row.sourceKey !== sourceKey;
    });
    if (!foreign) return state.get(dataset);
    for (const run of running.values()) run.controller.abort();
    running.clear();
    state.purgeAll();
    return undefined;
  }

  function markUnexpected(dataset: CacheDataset): void {
    try {
      state.markFailed(dataset, badResponse.code);
    } catch {
      // The database is going away; there is nothing left to record.
    }
  }

  /** Start one sync. `attempted_at` is written before the first await, so concurrent callers find the run. */
  function startRun(dataset: CacheDataset, sourceKey: string): Run | undefined {
    const sync = syncs[dataset];
    if (sync === undefined) return undefined;
    const startedAt = now();
    state.begin(dataset, sourceKey, startedAt);
    const controller = new AbortController();
    const done = sync({ baseUrl: adminUrl(), sourceKey, startedAt, signal: controller.signal })
      .catch((): SyncOutcome => {
        if (!controller.signal.aborted) markUnexpected(dataset);
        return { ok: false, failure: badResponse };
      })
      .finally(() => {
        if (running.get(dataset) === run) running.delete(dataset);
      });
    const run: Run = { done, controller };
    running.set(dataset, run);
    return run;
  }

  /**
   * A page is about to read `dataset`: one indexed row read. Due and warm: start the sync detached and return.
   * Due and cold: wait for the one sync (unless `awaitCold` is false), so the read answers with what it fetched.
   */
  async function ensureFresh(dataset: CacheDataset, options: { awaitCold?: boolean } = {}): Promise<void> {
    if (closed) return;
    const sourceKey = sourceKeyOf(adminUrl());
    const row = currentRow(dataset, sourceKey);
    const inFlight = running.get(dataset);
    if (inFlight === undefined && !isDue(row, { now: now(), sourceKey })) return;
    const run = inFlight ?? startRun(dataset, sourceKey);
    const cold = row === undefined || row.syncedAt === null;
    if (run !== undefined && cold && options.awaitCold !== false) await run.done;
  }

  return {
    /** Launch: check every dataset, detached. Errors are swallowed; the cache keeps serving what it has. */
    start(): void {
      for (const dataset of CACHE_DATASETS) void ensureFresh(dataset, { awaitCold: false }).catch(() => undefined);
    },

    ensureFresh,

    /** A manual Refresh: sync now whatever the window and the retry gap say, or join the run in flight. */
    async refresh(dataset: CacheDataset): Promise<SyncOutcome> {
      if (closed) return { ok: false, failure: unreachable };
      const sourceKey = sourceKeyOf(adminUrl());
      currentRow(dataset, sourceKey);
      const run = running.get(dataset) ?? startRun(dataset, sourceKey);
      return run === undefined ? { ok: true } : run.done;
    },

    /** The stored facts of a dataset, for the backend state the interface shows. */
    rowOf: (dataset: CacheDataset): CacheStateRow | undefined => state.get(dataset),

    /** Quit: stop every sync and wait for each to settle, so nothing writes after the database closes. */
    async close(): Promise<void> {
      closed = true;
      const runs = [...running.values()];
      for (const run of runs) run.controller.abort();
      await Promise.allSettled(runs.map((run) => run.done));
    },
  };
}

export type BackendCacheService = ReturnType<typeof createBackendCacheService>;
