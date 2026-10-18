import type { Store } from "../store/store.js";
import type { ProgressReport } from "../types/job-progress.js";
import type { TmdbClient } from "./tmdb-client.js";
import type { StoreRow } from "./title-store-row.js";
import {
  type Kind,
  type SyncRequest,
  DEFAULT_DISCOVER_PAGES,
  DEFAULT_SYNC_PAGES,
  KINDS,
  MAX_DISCOVER_PAGES,
  MAX_SYNC_PAGES,
  asRecord,
  listOf,
  num,
} from "./title-shapes.js";

/** What one run shares with its walk: its stop signal, its progress report and the count of rows seen so far. */
export interface WalkRun {
  signal: AbortSignal;
  report: ProgressReport;
  /** Rows TMDB listed so far (stored or skipped); it is read after an error too, so a failed run keeps its count. */
  seen: { titles: number };
  /** Set by shutdown: the walk ends between pages. */
  shuttingDown: () => boolean;
}

/** The phase a request starts in (docs/44 section 3.1): the Library fill walks `movies` then `tv`; other scopes one. */
export const firstPhase = (request: SyncRequest): string => (request.scope === "discover" ? "movies" : "list");

/**
 * The catalog walk (docs/03 section 7.6b): the Library fill pages through TMDB's discover list by popularity, both
 * kinds, each capped at `pages` and ended early by TMDB's own `total_pages`; trending and popular page one list. Each page
 * is written in one transaction, the signal is checked between pages, and progress counts pages of the kind in hand.
 */
export function createTitleWalk(deps: { store: Store; tmdb: TmdbClient; storeRow: StoreRow }) {
  const { store, tmdb, storeRow } = deps;

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

  return async function walk(request: SyncRequest, run: WalkRun): Promise<void> {
    const { signal } = run;
    if (request.scope === "discover") {
      const pages = Math.min(request.pages ?? DEFAULT_DISCOVER_PAGES, MAX_DISCOVER_PAGES);
      for (const kind of KINDS) {
        const fetchPage = (page: number) =>
          tmdb.get(`/discover/${kind}`, { sort_by: "popularity.desc", page }, { signal });
        await walkKind(kind, kind === "movie" ? "movies" : "tv", pages, fetchPage, run);
      }
      return;
    }
    const kind = request.kind ?? "movie";
    const pages = Math.min(request.pages ?? DEFAULT_SYNC_PAGES, MAX_SYNC_PAGES);
    const path = request.scope === "trending" ? `/trending/${kind}/week` : `/${kind}/popular`;
    await walkKind(kind, "list", pages, (page) => tmdb.get(path, { page }, { signal }), run);
  };
}
