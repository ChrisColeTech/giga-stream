import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import { type BrowseQuery, type Kind, type ListAnswer, asRecord, listOf, num, rowsOf } from "./title-shapes.js";

/** The admin's Browse query: both kinds (`all`) or one. */
export type TmdbBrowseQuery = Omit<BrowseQuery, "kind"> & { kind: Kind | "all" };

/** A Browse row: TMDB's answer mapped, and whether the store already holds it (`stored`) or has it deleted (`deleted`). */
export type TmdbRow = Record<string, unknown> & { stored: boolean; deleted: boolean };

/** TMDB's `/discover/{kind}` parameters for a Browse query. */
export function discoverParams(query: BrowseQuery): Record<string, string | number | undefined> {
  const date = query.kind === "tv" ? "first_air_date" : "primary_release_date";
  const sorts = {
    newest: `${date}.desc`, oldest: `${date}.asc`, year: `${date}.desc`,
    az: query.kind === "tv" ? "name.asc" : "title.asc", trending: "popularity.desc",
  };
  return {
    page: query.page, sort_by: sorts[query.sort], with_genres: query.genre,
    [query.kind === "tv" ? "first_air_date_year" : "primary_release_year"]: query.year,
    "vote_count.gte": query.sort !== "trending" ? 50 : undefined,
  };
}

/**
 * Browse TMDB (docs/47 section 3.3): the admin's own tool for finding titles TMDB has that the store lacks. It reads
 * TMDB through the one client and shows TMDB's answer; it WRITES NOTHING to the store. Each row says whether its
 * id is already stored and whether the admin deleted it. TMDB out of reach is `503 tmdb.unavailable`.
 */
export function createTmdbBrowse(deps: { store: Store; tmdb: TmdbClient; now: () => number }) {
  const { store, tmdb, now } = deps;

  function unavailable(): AppError {
    return new AppError(ERRORS.tmdbUnavailable, { reason: "not configured" });
  }

  async function marked(kind: Kind, rows: Record<string, unknown>[]): Promise<TmdbRow[]> {
    return Promise.all(rows.map(async (row) => {
      const id = num(row.tmdbId);
      const known = id !== undefined;
      return {
        ...row, state: "synced", stored: known && (await store.titles.find(kind, id)) !== undefined,
        deleted: known && (await store.deletedTitles.has(kind, id)),
      };
    }));
  }

  async function page(kind: Kind, path: string, params: Record<string, string | number | undefined>, wanted: number) {
    if (!tmdb.configured) throw unavailable();
    const answer = asRecord(await tmdb.get(path, params));
    const candidates = listOf(answer.results).filter((r) => asRecord(r).media_type !== "person");
    const items = await marked(kind, rowsOf(kind, candidates, now()));
    const totalPages = Math.min(num(answer.total_pages) ?? 1, 500);
    return { items, page: wanted, totalPages, totalResults: num(answer.total_results) ?? items.length, skipped: 0 };
  }

  return {
    async browse(query: TmdbBrowseQuery): Promise<ListAnswer> {
      const kinds: Kind[] = query.kind === "all" ? ["movie", "tv"] : [query.kind];
      const answers = await Promise.all(kinds.map((kind) =>
        page(kind, `/discover/${kind}`, discoverParams({ ...query, kind }), query.page)));
      return {
        items: answers.flatMap((a) => a.items),
        page: query.page,
        totalPages: Math.max(...answers.map((a) => a.totalPages)),
        totalResults: answers.reduce((sum, a) => sum + a.totalResults, 0),
        skipped: 0,
      };
    },

    search: (kind: Kind, q: string, pageNumber: number): Promise<ListAnswer> =>
      page(kind, `/search/${kind}`, { query: q, page: pageNumber, include_adult: "false" }, pageNumber),
  };
}

export type TmdbBrowse = ReturnType<typeof createTmdbBrowse>;
