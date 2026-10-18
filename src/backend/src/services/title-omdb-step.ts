import { OMDB_MAX_ERRORS } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { OmdbClient } from "./omdb-client.js";
import { type Kind, asRecord, num, omdbBlockOf, str, titleIdOf } from "./title-shapes.js";

/** One run's OMDb state: `off` once the budget is spent, the key refused, or OMDb keeps failing. */
export interface OmdbRun {
  off: boolean;
  errors: number;
}

export const newOmdbRun = (): OmdbRun => ({ off: false, errors: 0 });

/**
 * The OMDb step of the Library fill's `details` phase (docs/11 section 7.3): after a title's TMDB detail is stored, once
 * per freshness window, ONE call by IMDb id, inside the daily budget, written in its own short transaction as the
 * payload's `omdb` block. A title without a key, an IMDb id or a stored detail, or a disabled one, is left alone. A miss
 * is recorded on the title (`omdb_failed_at`, so it waits out the window); an outage or a spent budget is not - the next
 * run asks again - and neither fails the title, the phase or the run. Answers whether the title was enriched.
 */
export function createOmdbStep(deps: { store: Store; omdb: OmdbClient; now: () => number }) {
  const { store, omdb, now } = deps;
  return async function enrich(run: OmdbRun, kind: Kind, tmdbId: number, staleBefore: number, signal: AbortSignal): Promise<boolean> {
    if (run.off || !omdb.available()) return false;
    const row = store.titles.find(kind, tmdbId);
    const payload = asRecord(row?.payload);
    const imdbId = str(payload.imdbId);
    if (row === undefined || !row.enabled || payload.shape !== "detail" || imdbId === undefined) return false;
    if ((num(asRecord(payload.omdb).fetchedAt) ?? 0) >= staleBefore) return false;
    const id = titleIdOf(kind, tmdbId);
    const answer = await omdb.lookup(imdbId, signal);
    if (answer.status === "over") run.off = true;
    else if (answer.status === "error") run.off = ++run.errors >= OMDB_MAX_ERRORS;
    else if (answer.status === "miss") store.titles.queue.setOmdbFailure(id, now());
    if (answer.status !== "found") return false;
    run.errors = 0;
    return store.transaction(() => {
      const current = store.titles.find(kind, tmdbId);
      if (current === undefined) return false; // deleted while the call was in flight
      store.titles.put({
        kind,
        tmdbId,
        payload: { ...asRecord(current.payload), omdb: omdbBlockOf(answer.record, now()) },
        popularityScore: current.popularityScore,
        popularityReadAt: current.popularityReadAt,
        fetchedAt: current.fetchedAt,
      });
      store.titles.queue.setOmdbFailure(id, null);
      return true;
    });
  };
}

export type OmdbStep = ReturnType<typeof createOmdbStep>;
