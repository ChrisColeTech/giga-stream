import { RECENT_DAYS } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import { DAY_MS, isoDay } from "./title-days.js";
import { type PhaseRun, isStopping } from "./title-run.js";
import { sliceParams } from "./title-slices.js";
import type { StoreRow } from "./title-store-row.js";
import { type Kind, KINDS, MAX_DISCOVER_PAGES, asRecord, listOf, num } from "./title-shapes.js";

const PHASE = "recent";

/** The pages TMDB says a list has, at least one and at most its own limit. */
const pagesOf = (answer: Record<string, unknown>): number =>
  Math.min(Math.max(num(answer.total_pages) ?? 1, 1), MAX_DISCOVER_PAGES);

/**
 * The Library update's `recent` phase (docs/49 section 2.2): per kind, the discover list of the last `RECENT_DAYS` days
 * (`sliceParams`: popularity order, the vote floor, both ends inclusive), every page, stopping at an empty one. Rows are
 * stored exactly as the fill's walk stores them (`storeRow`), one page a transaction. Page 1 of both kinds is read first
 * so the progress total (pages across both kinds) is known before the first page is written and never goes down.
 */
export function createRecentPhase(deps: {
  store: Pick<Store, "transaction">; tmdb: Pick<TmdbClient, "get">; storeRow: StoreRow; now: () => number;
}) {
  const { store, tmdb, storeRow, now } = deps;

  return async function recent(run: PhaseRun): Promise<void> {
    const slice = { from: isoDay(now() - RECENT_DAYS * DAY_MS), to: isoDay(now()) };
    const fetchPage = async (kind: Kind, page: number): Promise<Record<string, unknown>> =>
      asRecord(await tmdb.get(`/discover/${kind}`, sliceParams(kind, slice, page), { signal: run.signal }));
    const firsts = new Map<Kind, Record<string, unknown>>();
    let total = 0;
    for (const kind of KINDS) {
      const first = await fetchPage(kind, 1);
      if (isStopping(run)) return;
      firsts.set(kind, first);
      total += pagesOf(first);
    }
    run.report({ phase: PHASE, done: 0, total });
    let done = 0;
    for (const kind of KINDS) {
      let answer = firsts.get(kind) ?? {};
      const last = pagesOf(answer);
      for (let page = 1; page <= last; page++) {
        if (page > 1) {
          answer = await fetchPage(kind, page);
          if (isStopping(run)) return;
        }
        const rows = listOf(answer.results);
        run.seen.titles += rows.length;
        await store.transaction(async () => {
          for (const row of rows) await storeRow(kind, asRecord(row));
        });
        run.report({ phase: PHASE, done: ++done, total });
        if (rows.length === 0) break;
      }
    }
    run.report({ phase: PHASE, done: total, total });
  };
}
