import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { OmdbClient } from "./omdb-client.js";
import type { TmdbClient } from "./tmdb-client.js";
import {
  type BrowseQuery,
  type Kind,
  type ListAnswer,
  LIST_FRESH_MS,
  TITLE_FRESH_MS,
  asRecord,
  detailOf,
  listOf,
  mapTitle404,
  num,
  omdbBlockOf,
  parseTitleId,
  rowOf,
  str,
  titleIdOf,
} from "./title-shapes.js";

/**
 * The fill-through reads (docs/03 section 7.6b): the store while fresh, TMDB on a miss — and the
 * OMDb enrichment the detail answer carries (docs/11 section 7.3).
 */
export function createTitleReads(deps: { store: Store; tmdb: TmdbClient; omdb: OmdbClient; now: () => number }) {
  const { store, tmdb, omdb, now } = deps;

  /** A full TMDB record, stored with its shape and its IMDb id (docs/11 section 7 needs the id). */
  async function ensureTitle(kind: Kind, tmdbId: number, force = false): Promise<Record<string, unknown>> {
    const found = store.titles.find(kind, tmdbId);
    if (!force && found && now() - found.fetchedAt < TITLE_FRESH_MS) {
      return asRecord(found.payload);
    }
    const answer = asRecord(await tmdb.get(`/${kind}/${tmdbId}`, { append_to_response: "credits,external_ids" }));
    const popularity = num(answer.popularity);
    const payload = detailOf(kind, tmdbId, answer);
    store.titles.put({
      kind,
      tmdbId,
      payload,
      popularityScore: popularity ?? null,
      popularityReadAt: now(),
      fetchedAt: now(),
    });
    return payload;
  }

  /**
   * OMDb enrichment: after TMDB's detail, once per title per freshness window, one call by IMDb id,
   * inside the daily budget. A miss, no id, or no key leaves the payload as it is.
   */
  async function enrichWithOmdb(kind: Kind, tmdbId: number, payload: Record<string, unknown>): Promise<void> {
    const imdbId = str(payload.imdbId);
    if (imdbId === undefined) return;
    const fetchedAt = num(asRecord(payload.omdb).fetchedAt);
    if (fetchedAt !== undefined && now() - fetchedAt < TITLE_FRESH_MS) return;
    const record = await omdb.get(imdbId);
    if (record === undefined) return;
    payload.omdb = omdbBlockOf(record, now());
    const stored = store.titles.find(kind, tmdbId);
    store.titles.put({
      kind,
      tmdbId,
      payload,
      popularityScore: stored?.popularityScore ?? null,
      popularityReadAt: stored?.popularityReadAt ?? null,
      fetchedAt: stored?.fetchedAt ?? now(),
    });
  }

  return {
    ensureTitle,

    /** The `7.4` browse page: the stored list while fresh, TMDB discover through fill-through. */
    async browse(query: BrowseQuery): Promise<ListAnswer> {
      const key = [query.kind, query.sort, query.genre ?? "-", query.year ?? "-", query.page].join("|");
      const stored = store.titles.findList(key);
      if (stored && now() - stored.fetchedAt < LIST_FRESH_MS && query.sort !== "trending") {
        const items = stored.ids.map((id) => {
          const found = store.titles.find(query.kind, id);
          return found
            ? asRecord(found.payload)
            : { id: titleIdOf(query.kind, id), tmdbId: id, kind: query.kind, title: "" };
        });
        return { items, page: query.page, totalPages: stored.totalPages, totalResults: stored.totalResults };
      }
      const tmdbSort: Record<BrowseQuery["sort"], string> = {
        newest: "primary_release_date.desc",
        oldest: "primary_release_date.asc",
        az: "title.asc",
        year: "primary_release_year.desc",
        trending: "popularity.desc",
      };
      const answer = asRecord(
        await tmdb.get(`/discover/${query.kind}`, {
          page: query.page,
          sort_by: tmdbSort[query.sort],
          with_genres: query.genre,
          primary_release_year: query.year,
          "vote_count.gte":
            query.sort === "newest" || query.sort === "oldest" || query.sort === "year" ? 50 : undefined,
        }),
      );
      const results = listOf(answer.results).map((r) => rowOf(query.kind, asRecord(r), now()));
      const ids = results.map((r) => num(r.tmdbId) ?? 0);
      store.titles.putList(key, ids, num(answer.total_pages) ?? 1, num(answer.total_results) ?? ids.length, now());
      return {
        items: results,
        page: query.page,
        totalPages: Math.min(num(answer.total_pages) ?? 1, 500),
        totalResults: num(answer.total_results) ?? ids.length,
      };
    },

    async search(kind: Kind, q: string, page: number): Promise<ListAnswer> {
      const answer = asRecord(await tmdb.get(`/search/${kind}`, { query: q, page, include_adult: "false" }));
      const results = listOf(answer.results)
        .filter((r) => asRecord(r).media_type !== "person")
        .map((r) => rowOf(kind, asRecord(r), now()));
      return {
        items: results,
        page,
        totalPages: Math.min(num(answer.total_pages) ?? 1, 500),
        totalResults: num(answer.total_results) ?? results.length,
      };
    },

    /** Genres, kept in memory for hours; small enough not to need the store. */
    async genres(kind: Kind): Promise<unknown> {
      const answer = asRecord(await tmdb.get(`/genre/${kind}/list`));
      return answer.genres ?? [];
    },

    async detail(titleId: string): Promise<Record<string, unknown>> {
      const [kind, id] = parseTitleId(titleId);
      try {
        // A thin list row is fresh but incomplete: one forced fetch fills it (docs/11 section 7.3).
        let payload = await ensureTitle(kind, id);
        if (payload.shape !== "detail") payload = await ensureTitle(kind, id, true);
        await enrichWithOmdb(kind, id, payload);
        if (str(payload.title) === undefined) throw new AppError(ERRORS.titleNotFound, { titleId });
        return payload;
      } catch (error) {
        return mapTitle404(error, titleId);
      }
    },

    async seasons(titleId: string, season: number): Promise<{ episodes: unknown[] }> {
      const [kind, id] = parseTitleId(titleId);
      if (kind !== "tv") throw new AppError(ERRORS.titleNotFound, { titleId });
      try {
        const payload = await ensureTitle(kind, id);
        const known = listOf(payload.seasons).find(
          (s) => num(asRecord(s).season) === season && Array.isArray(asRecord(s).episodes),
        );
        if (known) return { episodes: asRecord(known).episodes as unknown[] };
        const answer = asRecord(await tmdb.get(`/tv/${id}/season/${season}`));
        const episodes = listOf(answer.episodes).map((e) => {
          const row = asRecord(e);
          const runtime = num(row.runtime);
          return {
            season,
            episode: num(row.episode_number) ?? 0,
            title: str(row.name),
            airDate: str(row.air_date),
            ...(runtime !== undefined && { runtimeMs: runtime * 60_000 }),
            stillUrl: str(row.still_path) ? `https://image.tmdb.org/t/p/w300${row.still_path}` : undefined,
          };
        });
        payload.seasons = [...listOf(payload.seasons).filter((s) => num(asRecord(s).season) !== season), { season, episodes }];
        const existing = store.titles.find(kind, id);
        store.titles.put({
          kind,
          tmdbId: id,
          payload,
          popularityScore: existing?.popularityScore ?? null,
          popularityReadAt: existing?.popularityReadAt ?? null,
          fetchedAt: now(),
        });
        return { episodes };
      } catch (error) {
        return mapTitle404(error, titleId);
      }
    },

    async recommendations(titleId: string): Promise<{ items: Record<string, unknown>[] }> {
      const [kind, id] = parseTitleId(titleId);
      try {
        const answer = asRecord(await tmdb.get(`/${kind}/${id}/recommendations`, { page: 1 }));
        return { items: listOf(answer.results).map((r) => rowOf(kind, asRecord(r), now())) };
      } catch (error) {
        return mapTitle404(error, titleId);
      }
    },
  };
}
