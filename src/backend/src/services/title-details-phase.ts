import { TITLE_DETAIL_MAX_FAILURES } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { PendingDetail } from "../store/title-details.js";
import { type DetailFetch, isRowFailure } from "./title-detail-fetch.js";
import { type OmdbClient } from "./omdb-client.js";
import { type OmdbStep, newOmdbRun } from "./title-omdb-step.js";
import { type PhaseRun, isStopping } from "./title-run.js";
import { TITLE_FRESH_MS } from "./title-shapes.js";

/** The Library update's `refresh` mode (docs/49 section 2.2): the airing series' title ids, fetched whatever their age. */
export interface RefreshMode {
  forced: readonly string[];
}

/**
 * The Library fill's `details` phase (docs/47 section 3.1). The store is asked, by query, for the titles still missing
 * something - a list-only title, a detail older than `TITLE_FRESH_MS`, a series with a season lacking episodes, and with
 * OMDb on a detail with an IMDb id and no fresh `omdb` block - so a Stop then Run resumes where it stood. Each title gets
 * its detail call(s) in popularity order (`title-detail-fetch.ts`) and is written in its own short transaction; then its
 * OMDb step (`title-omdb-step.ts`) runs, inside the same progress. A failure of one title (a `404` for a removed title)
 * is recorded on it and the phase goes on; three failed runs in a row skip it until its payload changes. Any other TMDB
 * failure ends the run and keeps what was written. OMDb never fails a title or the run: when its budget is spent the
 * rest of the run is TMDB only, and the titles still lacking a block are picked up by the next run.
 *
 * With a `RefreshMode` it is the Library update's `refresh` phase: the queue has no age clause (the airing series are
 * forced instead), a gap title is fetched for the missing seasons alone, and the progress phase is `refresh`.
 */
export function createDetailsPhase(deps: {
  store: Store; fetchDetail: DetailFetch; omdb: OmdbClient; enrichOmdb: OmdbStep; now: () => number;
}) {
  const { store, fetchDetail, omdb, enrichOmdb, now } = deps;

  return async function details(run: PhaseRun, mode?: RefreshMode): Promise<void> {
    const staleBefore = now() - TITLE_FRESH_MS;
    const phase = mode === undefined ? "details" : "refresh";
    const queue: Array<PendingDetail & { force?: boolean }> = mode === undefined
      ? await store.titles.queue.pendingDetails(staleBefore, TITLE_DETAIL_MAX_FAILURES, omdb.available())
      : await store.titles.update.refreshQueue(mode.forced, TITLE_DETAIL_MAX_FAILURES, omdb.available(), staleBefore);
    const omdbRun = newOmdbRun();
    run.report({ phase, done: 0, total: queue.length });
    let done = 0;
    for (const item of queue) {
      if (isStopping(run)) return;
      try {
        // The update has no age clause: a title that is not forced is fetched for what it lacks, never for its age.
        const options = mode === undefined
          ? { signal: run.signal, mustExist: true, staleBefore }
          : { signal: run.signal, mustExist: true, staleBefore: 0, force: item.force === true };
        const fetched = await fetchDetail(item.kind, item.tmdbId, options);
        if (fetched !== undefined) {
          run.seen.detailed += 1;
          run.seen.seasons += fetched.seasons;
        }
        if (isStopping(run)) return;
        if (await enrichOmdb(omdbRun, item.kind, item.tmdbId, staleBefore, run.signal)) run.seen.enriched += 1;
        if (isStopping(run)) return;
      } catch (error: unknown) {
        if (isStopping(run)) return;
        if (!isRowFailure(error)) throw error;
        await store.titles.queue.noteDetailFailure(item.id, now());
      }
      run.report({ phase, done: ++done, total: queue.length });
    }
  };
}
