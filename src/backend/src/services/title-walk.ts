import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import type { PhaseRun } from "./title-run.js";
import type { StoreRow } from "./title-store-row.js";
import { DISCOVER_PAGE_SIZE } from "../constants/limits.js";
import { type Slice, labelOf, sliceList, sliceParams, splitSlice } from "./title-slices.js";
import { isStopping } from "./title-run.js";
import {
  type Kind,
  type SyncRequest,
  DEFAULT_SYNC_PAGES,
  KINDS,
  MAX_DISCOVER_PAGES,
  MAX_SYNC_PAGES,
  asRecord,
  listOf,
  num,
} from "./title-shapes.js";

export type WalkRun = PhaseRun;

/** The phase a request starts in (docs/44 section 3.1): the Library fill walks `movies` then `tv`; other scopes one. */
export const firstPhase = (request: SyncRequest): string => (request.scope === "discover" ? "movies" : "list");

/**
 * The catalog walk (docs/03 section 7.6b, docs/48): the Library fill walks TMDB's discover list by popularity, both
 * kinds, one slice (a year) at a time, so no query meets TMDB's 500-page limit; `pages` does not apply to it. Trending and
 * popular page one list, capped at `pages`. Each page is written in one transaction, the signal is checked between pages.
 */
export function createTitleWalk(deps: {
  store: Pick<Store, "transaction">;
  tmdb: Pick<TmdbClient, "get">;
  storeRow: StoreRow;
  now: () => number;
}) {
  const { store, tmdb, storeRow, now } = deps;

  /** One page of `kind` into the store, in one transaction. */
  function writePage(kind: Kind, answer: Record<string, unknown>, run: WalkRun): void {
    const rows = listOf(answer.results);
    run.seen.titles += rows.length;
    store.transaction(() => {
      for (const row of rows) storeRow(kind, asRecord(row));
    });
  }

  /** Walks one kind's pages; `total_pages` from the first answer lowers the cap, and the progress total with it. */
  async function walkKind(
    kind: Kind, phase: string, cap: number, fetchPage: (page: number) => Promise<unknown>, run: WalkRun,
  ): Promise<void> {
    let last = cap;
    run.report({ phase, done: 0, total: last });
    for (let page = 1; page <= last; page++) {
      if (run.signal.aborted || run.shuttingDown()) return;
      const answer = asRecord(await fetchPage(page));
      if (run.signal.aborted || run.shuttingDown()) return;
      const available = num(answer.total_pages);
      if (available !== undefined) last = Math.min(last, Math.max(available, page));
      writePage(kind, answer, run);
      run.report({ phase, done: page, total: last });
    }
  }

  /**
   * Walks one kind slice by slice (docs/48): page 1 of a slice says its `total_pages`; above TMDB's 500 the slice is split
   * and its halves are walked in its place, otherwise its pages are written to the last one. Progress counts slices,
   * known before any call; a split adds one. A single day above the limit is walked to page 500 and noted.
   */
  async function walkSlices(kind: Kind, phase: string, run: WalkRun): Promise<void> {
    const queue = sliceList(now);
    let total = queue.length;
    let done = 0;
    run.report({ phase, done, total });
    const fetchPage = (slice: Slice, page: number) =>
      tmdb.get(`/discover/${kind}`, sliceParams(kind, slice, page), { signal: run.signal });
    for (let slice = queue.shift(); slice !== undefined; slice = queue.shift()) {
      if (isStopping(run)) return;
      let answer = asRecord(await fetchPage(slice, 1));
      if (isStopping(run)) return;
      const pages = num(answer.total_pages) ?? 1;
      const halves = pages > MAX_DISCOVER_PAGES ? splitSlice(slice) : undefined;
      if (halves !== undefined) {
        queue.unshift(...halves);
        run.report({ phase, done, total: ++total });
        continue;
      }
      if (pages > MAX_DISCOVER_PAGES) {
        run.notes?.push(`${kind} ${labelOf(slice)}: over ${MAX_DISCOVER_PAGES * DISCOVER_PAGE_SIZE} titles in one day`);
      }
      const last = Math.min(pages, MAX_DISCOVER_PAGES);
      for (let page = 1; page <= last; page++) {
        if (page > 1) {
          answer = asRecord(await fetchPage(slice, page));
          if (isStopping(run)) return;
        }
        writePage(kind, answer, run);
        if (listOf(answer.results).length === 0) break;
      }
      run.report({ phase, done: ++done, total });
    }
  }

  return async function walk(request: SyncRequest, run: WalkRun): Promise<void> {
    const { signal } = run;
    if (request.scope === "discover") {
      for (const kind of KINDS) await walkSlices(kind, kind === "movie" ? "movies" : "tv", run);
      return;
    }
    const kind = request.kind ?? "movie";
    const pages = Math.min(request.pages ?? DEFAULT_SYNC_PAGES, MAX_SYNC_PAGES);
    const path = request.scope === "trending" ? `/trending/${kind}/week` : `/${kind}/popular`;
    await walkKind(kind, "list", pages, (page) => tmdb.get(path, { page }, { signal }), run);
  };
}
