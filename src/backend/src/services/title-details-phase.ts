import { TITLE_DETAIL_MAX_FAILURES } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import { type DetailFetch, isRowFailure } from "./title-detail-fetch.js";
import { type PhaseRun, isStopping } from "./title-run.js";
import { TITLE_FRESH_MS } from "./title-shapes.js";

/**
 * The Library fill's `details` phase (docs/47 section 3.1). The store is asked, by query, for the titles still missing
 * something - a list-only title, a detail older than `TITLE_FRESH_MS`, a series with a season lacking episodes - so a Stop
 * then Run resumes where it stood. Each title gets its detail call(s) in popularity order (`title-detail-fetch.ts`) and is
 * written in its own short transaction. A failure of one title (a `404` for a removed title) is recorded on it and the
 * phase goes on; three failed runs in a row skip it until its payload changes. Any other failure ends the run and keeps
 * what was written. There is no OMDb call here.
 */
export function createDetailsPhase(deps: { store: Store; fetchDetail: DetailFetch; now: () => number }) {
  const { store, fetchDetail, now } = deps;

  return async function details(run: PhaseRun): Promise<void> {
    const staleBefore = now() - TITLE_FRESH_MS;
    const queue = store.titles.queue.pendingDetails(staleBefore, TITLE_DETAIL_MAX_FAILURES);
    run.report({ phase: "details", done: 0, total: queue.length });
    let done = 0;
    for (const item of queue) {
      if (isStopping(run)) return;
      try {
        const fetched = await fetchDetail(item.kind, item.tmdbId, { signal: run.signal, mustExist: true, staleBefore });
        if (fetched !== undefined) {
          run.seen.detailed += 1;
          run.seen.seasons += fetched.seasons;
        }
      } catch (error: unknown) {
        if (isStopping(run)) return;
        if (!isRowFailure(error)) throw error;
        store.titles.queue.noteDetailFailure(item.id, now());
      }
      run.report({ phase: "details", done: ++done, total: queue.length });
    }
  };
}
