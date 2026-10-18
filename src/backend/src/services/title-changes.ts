import { CHANGES_MAX_WINDOW_DAYS as MAX_DAYS } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import { DAY_MS, dayIso, dayNumber, isoDay } from "./title-days.js";
import { type PhaseRun, isStopping } from "./title-run.js";
import {
  type Kind, type SyncRequest, KINDS, MAX_DISCOVER_PAGES, asRecord, listOf, num, titleIdOf,
} from "./title-shapes.js";

const PHASE = "changes";

/** A window of days, both ends inclusive (TMDB's `start_date` and `end_date`). */
interface Window {
  from: string;
  to: string;
}

/**
 * The two halves of a window TMDB pages only to 500 (50,000 ids): they share the middle day, so no day is lost whatever
 * the edge semantics; the ids are a set, so the shared day costs only its calls. A single day cannot be split.
 */
function halves(window: Window): [Window, Window] | undefined {
  const [first, last] = [dayNumber(window.from), dayNumber(window.to)];
  if (first >= last) return undefined;
  if (last - first === 1) return [{ from: window.from, to: window.from }, { from: window.to, to: window.to }];
  const middle = dayIso(Math.floor((first + last) / 2));
  return [{ from: window.from, to: middle }, { from: middle, to: window.to }];
}

/**
 * The Library update's `changes` phase (docs/49 section 2.2): per kind, TMDB's `/{movie|tv}/changes` for the window
 * `[start, today]`, every page. `start` is the job's cursor day, never more than `CHANGES_MAX_WINDOW_DAYS` back (a longer
 * range is a 422); a never-run job has no cursor and an older one is clamped, and the run's notes say a Library fill covers
 * more. A window above 500 pages (TMDB refuses a page past 500) is halved. The ids carry no votes, so this finds no new
 * title: it picks the STORED ones (enabled, TMDB, not deleted) with ONE set-based query per kind. Answers their title ids.
 */
export function createChangesPhase(deps: {
  store: Pick<Store, "titles">; tmdb: Pick<TmdbClient, "get">; now: () => number;
}) {
  const { store, tmdb, now } = deps;

  return async function changes(request: SyncRequest, run: PhaseRun): Promise<string[]> {
    const today = isoDay(now());
    const floor = isoDay(now() - MAX_DAYS * DAY_MS);
    const since = request.since === undefined ? undefined : isoDay(request.since);
    const start = since !== undefined && since > floor ? since : floor;
    const cover = `changes cover ${floor} to ${today}; a Library fill covers more`;
    if (since === undefined) run.notes?.push(`no cursor yet: ${cover}`);
    else if (since < floor) run.notes?.push(`the cursor is older than ${MAX_DAYS} days: ${cover}`);
    const fetchPage = async (kind: Kind, window: Window, page: number): Promise<Record<string, unknown>> => {
      const params = { start_date: window.from, end_date: window.to, page };
      return asRecord(await tmdb.get(`/${kind}/changes`, params, { signal: run.signal }));
    };
    let [done, total] = [0, 0];
    run.report({ phase: PHASE, done, total });
    const changed: string[] = [];
    for (const kind of KINDS) {
      const ids = new Set<number>();
      const queue: Window[] = [{ from: start, to: today }];
      for (let window = queue.shift(); window !== undefined; window = queue.shift()) {
        let answer = await fetchPage(kind, window, 1);
        if (isStopping(run)) return changed;
        const pages = num(answer.total_pages) ?? 1;
        const split = pages > MAX_DISCOVER_PAGES ? halves(window) : undefined;
        if (split !== undefined) {
          queue.unshift(...split);
          continue;
        }
        if (pages > MAX_DISCOVER_PAGES) run.notes?.push(`${kind} changes ${window.from}: over ${MAX_DISCOVER_PAGES} pages`);
        const last = Math.min(Math.max(pages, 1), MAX_DISCOVER_PAGES);
        total += last;
        for (let page = 1; page <= last; page++) {
          if (page > 1) {
            answer = await fetchPage(kind, window, page);
            if (isStopping(run)) return changed;
          }
          const rows = listOf(answer.results);
          for (const row of rows) {
            const id = num(asRecord(row).id);
            if (id !== undefined) ids.add(id);
          }
          run.report({ phase: PHASE, done: ++done, total });
          if (rows.length === 0) break;
        }
      }
      for (const id of store.titles.update.storedAmong(kind, [...ids])) changed.push(titleIdOf(kind, id));
    }
    run.report({ phase: PHASE, done: total, total });
    return changed;
  };
}
