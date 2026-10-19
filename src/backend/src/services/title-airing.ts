import { AIRING_FIRST_DAYS, AIRING_MAX_DAYS, DISCOVER_MIN_VOTES } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import { DAY_MS, isoDay } from "./title-days.js";
import { type PhaseRun, isStopping } from "./title-run.js";
import type { StoreRow } from "./title-store-row.js";
import { type SyncRequest, MAX_DISCOVER_PAGES, asRecord, listOf, num, titleIdOf } from "./title-shapes.js";

const PHASE = "airing";

/**
 * The Library update's `airing` phase (docs/49 section 2.2): the series with an episode airing in `[start, today]`
 * (`GET /discover/tv?air_date.gte&air_date.lte`, the vote floor, popularity order), every page. `start` is the job's
 * cursor day, never more than `AIRING_MAX_DAYS` back (an older cursor is clamped and noted); a job with no cursor starts
 * `AIRING_FIRST_DAYS` back. Every row is stored like the other walks store theirs (a series not stored enters list-shaped
 * and the refresh details it). Before a page is written, `storedAmong` picks the series already stored (enabled, TMDB, not
 * deleted): they are answered as the forced set, which the refresh fetches again whatever their age.
 */
export function createAiringPhase(deps: {
  store: Pick<Store, "titles" | "transaction">; tmdb: Pick<TmdbClient, "get">; storeRow: StoreRow; now: () => number;
}) {
  const { store, tmdb, storeRow, now } = deps;

  return async function airing(request: SyncRequest, run: PhaseRun): Promise<string[]> {
    const today = isoDay(now());
    const floor = isoDay(now() - AIRING_MAX_DAYS * DAY_MS);
    const since = request.since === undefined ? isoDay(now() - AIRING_FIRST_DAYS * DAY_MS) : isoDay(request.since);
    if (since < floor) run.notes?.push(`the cursor is older than ${AIRING_MAX_DAYS} days: airing covers ${floor} to ${today}`);
    const start = since > floor ? since : floor;
    const fetchPage = async (page: number): Promise<Record<string, unknown>> => {
      const params = {
        sort_by: "popularity.desc", "vote_count.gte": DISCOVER_MIN_VOTES, "air_date.gte": start, "air_date.lte": today, page,
      };
      return asRecord(await tmdb.get("/discover/tv", params, { signal: run.signal }));
    };
    const forced: string[] = [];
    run.report({ phase: PHASE, done: 0, total: 0 });
    let answer = await fetchPage(1);
    if (isStopping(run)) return forced;
    const total = Math.min(Math.max(num(answer.total_pages) ?? 1, 1), MAX_DISCOVER_PAGES);
    run.report({ phase: PHASE, done: 0, total });
    for (let page = 1; page <= total; page++) {
      if (page > 1) {
        answer = await fetchPage(page);
        if (isStopping(run)) return forced;
      }
      const rows = listOf(answer.results).map(asRecord);
      run.seen.titles += rows.length;
      const ids = rows.flatMap((row) => num(row.id) ?? []);
      for (const id of await store.titles.update.storedAmong("tv", ids)) forced.push(titleIdOf("tv", id));
      await store.transaction(async () => {
        for (const row of rows) await storeRow("tv", row);
      });
      run.report({ phase: PHASE, done: page, total });
      if (rows.length === 0) break;
    }
    run.report({ phase: PHASE, done: total, total });
    return forced;
  };
}
