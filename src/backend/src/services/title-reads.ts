import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { OmdbClient } from "./omdb-client.js";
import type { TitleDeleted } from "./title-deleted.js";
import type { TmdbClient } from "./tmdb-client.js";
import { discoverParams, storedListItems, storeListItems } from "./title-list-cache.js";
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
  parseTitleId,
  rowsOf,
  str,
  storedRowOf,
} from "./title-shapes.js";
import { createOmdbEnricher } from "./title-omdb-enrich.js";

/**
 * The fill-through reads (docs/03 section 7.6b): the store while fresh, TMDB on a miss — and the
 * OMDb enrichment the detail answer carries (docs/11 section 7.3). A deleted title is never read or stored.
 */
export function createTitleReads(deps: {
  store: Store;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  deleted: TitleDeleted;
  now: () => number;
}) {
  const { store, tmdb, omdb, deleted, now } = deps;

  /** A deleted title answers as a missing one, whatever TMDB says. */
  function assertKept(kind: Kind, tmdbId: number): void {
    if (deleted.isDeleted(kind, tmdbId)) throw new AppError(ERRORS.titleNotFound, { titleId: `${kind}-${tmdbId}` });
  }

  /** A full TMDB record, stored with its shape and its IMDb id (docs/11 section 7 needs the id). */
  async function ensureTitle(kind: Kind, tmdbId: number, force = false): Promise<Record<string, unknown>> {
    assertKept(kind, tmdbId);
    const found = store.titles.find(kind, tmdbId);
    if (!force && found && now() - found.fetchedAt < TITLE_FRESH_MS) {
      const payload = storedRowOf(kind, tmdbId, found.payload, found.popularityReadAt ?? found.fetchedAt);
      if (payload !== undefined) return payload;
    }
    const answer = asRecord(await tmdb.get(`/${kind}/${tmdbId}`, { append_to_response: "credits,external_ids" }));
    const popularity = num(answer.popularity);
    const payload = detailOf(kind, tmdbId, answer);
    const previous = asRecord(found?.payload);
    const listSnapshot = previous.shape === "list" ? previous : previous.listSnapshot;
    if (listSnapshot !== undefined) payload.listSnapshot = listSnapshot;
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

  const enrichWithOmdb = createOmdbEnricher({ store, omdb, now });

  return {
    ensureTitle,
    /** The `7.4` browse page: the stored list while fresh, TMDB discover through fill-through. */
    async browse(query: BrowseQuery): Promise<ListAnswer> {
      const key = [query.kind, query.sort, query.genre ?? "-", query.year ?? "-", query.page].join("|");
      const stored = store.titles.findList(key);
      if (stored && now() - stored.fetchedAt < LIST_FRESH_MS && query.sort !== "trending") {
        const live = stored.ids.filter((id) => !deleted.isDeleted(query.kind, id));
        const items = storedListItems(store, query.kind, live);
        if (items !== undefined) {
          const skipped = stored.ids.length - live.length;
          return { items, page: query.page, totalPages: stored.totalPages, totalResults: stored.totalResults, skipped };
        }
      }
      const answer = asRecord(await tmdb.get(`/discover/${query.kind}`, discoverParams(query)));
      const fetchedAt = now();
      const all = rowsOf(query.kind, listOf(answer.results), fetchedAt);
      const { kept: results, skipped } = deleted.withoutDeleted(query.kind, all);
      const ids = all.map((r) => num(r.tmdbId) ?? 0);
      storeListItems(store, query.kind, results, fetchedAt);
      store.titles.putList(key, ids, Math.min(num(answer.total_pages) ?? 1, 500), num(answer.total_results) ?? ids.length, fetchedAt);
      return {
        items: results,
        page: query.page,
        totalPages: Math.min(num(answer.total_pages) ?? 1, 500),
        totalResults: num(answer.total_results) ?? ids.length,
        skipped,
      };
    },
    async search(kind: Kind, q: string, page: number): Promise<ListAnswer> {
      const answer = asRecord(await tmdb.get(`/search/${kind}`, { query: q, page, include_adult: "false" }));
      const candidates = listOf(answer.results).filter((r) => asRecord(r).media_type !== "person");
      const { kept: results, skipped } = deleted.withoutDeleted(kind, rowsOf(kind, candidates, now()));
      return {
        items: results,
        skipped,
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
        // A thin list row is fresh but incomplete: one forced fetch fills it (docs/11 section 7.3). A series
        // detail stored before the seasons mapping lacks them: one forced fetch heals it (docs/03 section 7.6b).
        let payload = await ensureTitle(kind, id);
        if (payload.shape !== "detail" || (kind === "tv" && !Array.isArray(payload.seasons))) {
          payload = await ensureTitle(kind, id, true);
        }
        await enrichWithOmdb(kind, id, payload);
        const output = storedRowOf(kind, id, payload, now());
        if (output === undefined) throw new AppError(ERRORS.titleNotFound, { titleId });
        delete output.listSnapshot;
        return output;
      } catch (error) {
        return mapTitle404(error, titleId);
      }
    },

    async seasons(titleId: string, season: number): Promise<{ episodes: unknown[] }> {
      const [kind, id] = parseTitleId(titleId);
      if (kind !== "tv") throw new AppError(ERRORS.titleNotFound, { titleId });
      assertKept(kind, id);
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
      assertKept(kind, id);
      try {
        const answer = asRecord(await tmdb.get(`/${kind}/${id}/recommendations`, { page: 1 }));
        return { items: deleted.withoutDeleted(kind, rowsOf(kind, listOf(answer.results), now())).kept };
      } catch (error) {
        return mapTitle404(error, titleId);
      }
    },
  };
}
