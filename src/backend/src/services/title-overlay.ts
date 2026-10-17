import type { Store } from "../store/store.js";
import type { StoredTitle } from "../store/title-repository.js";
import { applyFields } from "../store/title-edits.js";
import { type Sort, asRecord, num, str } from "./title-shapes.js";

export type TitleState = "synced" | "edited" | "manual";

export const stateOf = (row: StoredTitle): TitleState =>
  row.origin === "manual" ? "manual" : row.editedFields.length > 0 ? "edited" : "synced";

/**
 * A stored record as the routes answer it: its payload without the list snapshot, and its `state`. `enabled` is an
 * admin's field: it is on the admin's answers and never on a public read.
 */
export function viewOf(row: StoredTitle, withEnabled = true): Record<string, unknown> {
  const { listSnapshot: _snapshot, ...payload } = asRecord(row.payload);
  return { ...payload, id: row.id, kind: row.kind, state: stateOf(row), ...(withEnabled && { enabled: row.enabled }) };
}

const yearDesc = (a: Record<string, unknown>, b: Record<string, unknown>): number =>
  (num(b.year) ?? -Infinity) - (num(a.year) ?? -Infinity);
const yearAsc = (a: Record<string, unknown>, b: Record<string, unknown>): number =>
  (num(a.year) ?? Infinity) - (num(b.year) ?? Infinity);
const byTitle = (a: Record<string, unknown>, b: Record<string, unknown>): number =>
  (str(a.title) ?? "").localeCompare(str(b.title) ?? "", undefined, { sensitivity: "base" });

/**
 * What the title reads add to TMDB's answers (docs/26 decision D20): an admin's edits laid over a row TMDB has just
 * answered, a `state` on every item, the disabled titles left out of a public read (an admin's read, with
 * `includeDisabled`, keeps them and says `enabled`), and the titles made by hand merged in.
 */
export function createTitleOverlay(store: Store) {
  function decorate(items: Record<string, unknown>[], includeDisabled = false): Record<string, unknown>[] {
    const out: Record<string, unknown>[] = [];
    for (const item of items) {
      const row = store.titles.findById(str(item.id) ?? "");
      if (row === undefined || row.origin !== "tmdb") {
        out.push({ ...item, state: "synced", ...(includeDisabled && { enabled: true }) });
        continue;
      }
      if (!row.enabled && !includeDisabled) continue;
      const edited = row.editedFields.length > 0 ? applyFields(item, row.payload, row.editedFields) : item;
      out.push({ ...edited, state: stateOf(row), ...(includeDisabled && { enabled: row.enabled }) });
    }
    return out;
  }

  /** The titles made by hand that fit a browse or search, as list rows (a series' episodes stay out of a list). */
  function manualMatches(filter: {
    kind: "movie" | "tv"; genre?: string; year?: number; q?: string; includeDisabled?: boolean;
  }): Record<string, unknown>[] {
    const genre = filter.genre?.toLowerCase();
    const q = filter.q?.toLowerCase();
    return store.titles
      .listManual()
      .filter((row) => row.kind === filter.kind && (row.enabled || filter.includeDisabled === true))
      .map((row) => {
        const { seasons: _seasons, ...listRow } = viewOf(row, filter.includeDisabled === true);
        return listRow;
      })
      .filter((row) => filter.year === undefined || num(row.year) === filter.year)
      .filter((row) => genre === undefined || (Array.isArray(row.genres) && row.genres.some((g) => String(g).toLowerCase() === genre)))
      .filter((row) => q === undefined || (str(row.title) ?? "").toLowerCase().includes(q));
  }

  /** Page one carries the manual titles, placed by the sort; a manual title has no popularity, so `trending` ends with them. */
  function merge(tmdbItems: Record<string, unknown>[], manual: Record<string, unknown>[], sort: Sort): Record<string, unknown>[] {
    const all = [...tmdbItems, ...manual];
    if (sort === "newest" || sort === "year") return all.sort(yearDesc);
    if (sort === "oldest") return all.sort(yearAsc);
    if (sort === "az") return all.sort(byTitle);
    return all;
  }

  return { decorate, manualMatches, merge };
}

export type TitleOverlay = ReturnType<typeof createTitleOverlay>;
