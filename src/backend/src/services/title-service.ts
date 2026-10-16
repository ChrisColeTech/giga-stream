import { AppError, ERRORS } from "../constants/errors.js";
import type { Store } from "../store/store.js";
import type { EventSink } from "../types/events.js";
import type { Actor, AuditService } from "./audit-service.js";
import type { OmdbClient } from "./omdb-client.js";
import type { TmdbClient } from "./tmdb-client.js";

/** Freshness (docs/03 sections 7.6, 7.6b): days for titles, hours for lists and popularity. */
const TITLE_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
const LIST_FRESH_MS = 8 * 60 * 60 * 1000;
const DEFAULT_SYNC_PAGES = 5;
const MAX_SYNC_PAGES = 25;

export type Kind = "movie" | "tv";
export const KINDS: readonly Kind[] = ["movie", "tv"];
export const SORTS = ["newest", "oldest", "az", "year", "trending"] as const;
export type Sort = (typeof SORTS)[number];

export interface BrowseQuery {
  kind: Kind;
  sort: Sort;
  genre?: string;
  year?: number;
  page: number;
}

export interface SyncRequest {
  scope: "trending" | "popular" | "titles";
  kind?: Kind;
  pages?: number;
  ids?: number[];
}

export interface SyncStatus {
  running: boolean;
  startedAt?: number;
  lastRunAt?: number;
  lastOutcome?: string;
  titles: number;
  stale: number;
  schedule: string;
  omdb: { enabled: boolean; calls: number; limit: number };
}

interface ListAnswer {
  items: Record<string, unknown>[];
  page: number;
  totalPages: number;
  totalResults: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
const yearOf = (date: unknown): number | undefined => {
  const year = Number(str(date)?.slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : undefined;
};

/** TMDB answering `404` for a title is `title.not_found` (docs/03 section 7.4), not an outage. */
function mapTitle404(error: unknown, titleId: string): never {
  if (error instanceof AppError && error.details?.status === 404) {
    throw new AppError(ERRORS.titleNotFound, { titleId });
  }
  throw error;
}

export const parseTitleId = (titleId: string): [Kind, number] => {
  const match = /^(movie|tv)-(\d+)$/.exec(titleId);
  if (!match?.[2]) throw new AppError(ERRORS.titleNotFound, { titleId });
  return [match[1] === "tv" ? "tv" : "movie", Number(match[2])];
};

export const titleIdOf = (kind: Kind, tmdbId: number): string => `${kind}-${tmdbId}`;

/** The one sync schedule parser: "6h", "30m", "45s", "500ms"; empty or "off" means disabled. */
export function parseSchedule(value: string): number | undefined {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "" || trimmed === "off") return undefined;
  const match = /^(\d+)(ms|s|m|h)$/.exec(trimmed);
  if (!match?.[1]) throw new AppError(ERRORS.requestInvalid, { field: "TMDB_SYNC_SCHEDULE" }, "That sync schedule is not valid.");
  const n = Number(match[1]);
  return match[2] === "h" ? n * 3_600_000 : match[2] === "m" ? n * 60_000 : match[2] === "s" ? n * 1_000 : n;
}

/**
 * Titles (docs/03 sections 7.4, 7.6b): fill-through reads over the synced store, and the catalog-sync
 * job — one at a time, audited, announced, and the system's only scheduled timer (`01` section 4.4).
 */
export function createTitleService(deps: {
  store: Store;
  events: EventSink;
  audit: AuditService;
  tmdb: TmdbClient;
  omdb: OmdbClient;
  now: () => number;
}) {
  const { store, events, audit, tmdb, omdb, now } = deps;

  // ---- fill-through reads -------------------------------------------------

  /** A full TMDB record, stored with its shape and its IMDb id (docs/11 section 7 needs the id). */
  async function ensureTitle(kind: Kind, tmdbId: number, force = false): Promise<Record<string, unknown>> {
    const found = store.titles.find(kind, tmdbId);
    if (!force && found && now() - found.fetchedAt < TITLE_FRESH_MS) {
      return asRecord(found.payload);
    }
    const answer = asRecord(await tmdb.get(`/${kind}/${tmdbId}`, { append_to_response: "credits,external_ids" }));
    const cast = asRecord(answer.credits);
    const castList = Array.isArray(cast.cast) ? (cast.cast as unknown[]) : [];
    const genres = Array.isArray(answer.genres) ? (answer.genres as unknown[]) : [];
    const externalIds = asRecord(answer.external_ids);
    const payload: Record<string, unknown> = {
      id: titleIdOf(kind, tmdbId),
      tmdbId,
      kind,
      shape: "detail" as const,
      title: str(answer.title) ?? str(answer.name) ?? "",
      year: yearOf(answer.release_date) ?? yearOf(answer.first_air_date),
      genres: genres.map((g) => str(asRecord(g).name) ?? "").filter((name) => name !== ""),
      rating: num(answer.vote_average),
      posterUrl: str(answer.poster_path) ? `https://image.tmdb.org/t/p/w500${answer.poster_path}` : undefined,
      backdropUrl: str(answer.backdrop_path) ? `https://image.tmdb.org/t/p/w1280${answer.backdrop_path}` : undefined,
      plot: str(answer.overview),
      cast: castList.slice(0, 10).map((c) => str(asRecord(c).name) ?? "").filter((name) => name !== ""),
      runtimeMs: num(answer.runtime) !== undefined ? (num(answer.runtime) as number) * 60_000 : undefined,
      status: str(answer.status),
      imdbId: str(answer.imdb_id) ?? str(externalIds.imdb_id),
    };
    const popularity = num(answer.popularity);
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

  function rowOf(kind: Kind, tmdb: Record<string, unknown>): Record<string, unknown> {
    const tmdbId = num(tmdb.id);
    if (tmdbId === undefined) throw new AppError(ERRORS.tmdbUnavailable, { reason: "answer without an id" });
    const popularity = num(tmdb.popularity);
    return {
      id: titleIdOf(kind, tmdbId),
      tmdbId,
      kind,
      shape: "list" as const, // a thin row: the detail route enriches it when the title is opened
      title: str(tmdb.title) ?? str(tmdb.name) ?? "",
      year: yearOf(tmdb.release_date) ?? yearOf(tmdb.first_air_date),
      genres: Array.isArray(tmdb.genre_ids) ? (tmdb.genre_ids as unknown[]).map(String) : [],
      rating: num(tmdb.vote_average),
      posterUrl: str(tmdb.poster_path) ? `https://image.tmdb.org/t/p/w500${tmdb.poster_path}` : undefined,
      backdropUrl: str(tmdb.backdrop_path) ? `https://image.tmdb.org/t/p/w1280${tmdb.backdrop_path}` : undefined,
      ...(popularity !== undefined && { popularity: { score: popularity, readAt: now() } }),
    };
  }

  // ---- the sync job -------------------------------------------------------

  interface Job {
    startedAt: number;
    request: SyncRequest;
    triggered: "admin" | "system";
  }

  let running: Job | null = null;
  let lastRun: { finishedAt: number; outcome: string; titles: number; triggered: "admin" | "system" } | null = null;
  let scheduleTimer: ReturnType<typeof setTimeout> | undefined;
  let scheduleMs: number | undefined;
  let scheduledChain: Promise<void> = Promise.resolve();
  let stopped = false;

  function listPage(kind: Kind, source: "trending" | "popular", page: number) {
    const path = source === "trending" ? `/trending/${kind}/week` : `/${kind}/popular`;
    return tmdb.get<Record<string, unknown>>(path, { page });
  }

  async function runSync(request: SyncRequest, triggered: "admin" | "system", actor: Actor): Promise<number> {
    const startedAt = now();
    let pulled = 0;
    if (request.scope === "titles") {
      for (const id of request.ids ?? []) {
        if (stopped) return pulled;
        await ensureTitle("movie", id);
        pulled += 1;
      }
    } else {
      const kind = request.kind ?? "movie";
      const pages = Math.min(request.pages ?? DEFAULT_SYNC_PAGES, MAX_SYNC_PAGES);
      for (let page = 1; page <= pages; page++) {
        if (stopped) return pulled;
        const answer = asRecord(await listPage(kind, request.scope, page));
        if (stopped) return pulled;
        for (const row of Array.isArray(answer.results) ? (answer.results as unknown[]) : []) {
          if (stopped) return pulled;
          const record = asRecord(row);
          const id = num(record.id);
          if (id === undefined) continue;
          const existing = store.titles.find(kind, id);
          const fresh = existing !== undefined && now() - existing.fetchedAt < TITLE_FRESH_MS;
          const popularity = num(record.popularity);
          store.titles.put({
            kind,
            tmdbId: id,
            payload: fresh ? asRecord(existing.payload) : rowOf(kind, record),
            popularityScore: popularity ?? existing?.popularityScore ?? null,
            popularityReadAt: popularity !== undefined || popularity === null ? now() : existing?.popularityReadAt ?? null,
            fetchedAt: fresh ? existing.fetchedAt : now(),
          });
          pulled += 1;
        }
      }
    }
    if (stopped) return pulled; // the store may already be closed at shutdown
    lastRun = { finishedAt: now(), outcome: "ok", titles: pulled, triggered };
    const { stale } = store.titles.counts(TITLE_FRESH_MS);
    events.publish({
      type: "titles.synced",
      data: { titles: pulled, stale, ms: now() - startedAt, triggered },
    });
    return pulled;
  }

  function recordSyncAudit(action: "sync.started" | "sync.finished" | "sync.failed", actor: Actor, detail: Record<string, unknown>): void {
    if (stopped) return; // shutting down: the store may already be closed
    try {
      audit.record(actor, { action, subject: "titles", detail });
    } catch {
      // a shutdown between the guard and the write; the entry is lost, not the process
    }
  }

  /** The OMDb block of docs/11 section 7.2: only the fields the product shows, `Plot` kept raw. */
  function omdbBlockOf(record: Record<string, unknown>): Record<string, unknown> {
    const ratings = Array.isArray(record.Ratings) ? (record.Ratings as unknown[]) : [];
    return {
      fetchedAt: now(),
      rated: str(record.Rated),
      metascore: str(record.Metascore),
      imdbRating: str(record.imdbRating),
      imdbVotes: str(record.imdbVotes),
      ratings: ratings
        .map((r) => ({ source: str(asRecord(r).Source) ?? "", score: str(asRecord(r).Value) ?? "" }))
        .filter((r) => r.source !== ""),
      awards: str(record.Awards),
      boxOffice: str(record.BoxOffice),
      director: str(record.Director),
      writer: str(record.Writer),
      language: str(record.Language),
      country: str(record.Country),
      plot: str(record.Plot),
    };
  }

  /**
   * OMDb enrichment (docs/11 section 7.3): after TMDB's detail, once per title per freshness window,
   * one call by IMDb id, inside the daily budget. A miss, no id, or no key leaves the payload as it is.
   */
  async function enrichWithOmdb(kind: Kind, tmdbId: number, payload: Record<string, unknown>): Promise<void> {
    const imdbId = str(payload.imdbId);
    if (imdbId === undefined) return;
    const existing = asRecord(payload.omdb);
    const fetchedAt = num(existing.fetchedAt);
    if (fetchedAt !== undefined && now() - fetchedAt < TITLE_FRESH_MS) return;
    const record = await omdb.get(imdbId);
    if (record === undefined) return;
    payload.omdb = omdbBlockOf(record);
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

  function describeRequest(request: SyncRequest): Record<string, unknown> {
    return request.scope === "titles"
      ? { scope: "titles", ids: (request.ids ?? []).length }
      : { scope: request.scope, kind: request.kind, pages: request.pages };
  }

  return {
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
      const tmdbSort: Record<Sort, string> = {
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
          "vote_count.gte": query.sort === "newest" || query.sort === "oldest" || query.sort === "year" ? 50 : undefined,
        }),
      );
      const results = (Array.isArray(answer.results) ? (answer.results as unknown[]) : []).map((r) => rowOf(query.kind, asRecord(r)));
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
      const answer = asRecord(
        await tmdb.get(`/search/${kind}`, { query: q, page, include_adult: "false" }),
      );
      const results = (Array.isArray(answer.results) ? (answer.results as unknown[]) : [])
        .filter((r) => asRecord(r).media_type !== "person")
        .map((r) => rowOf(kind, asRecord(r)));
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
        const seasons = Array.isArray(payload.seasons) ? (payload.seasons as Record<string, unknown>[]) : [];
        const known = seasons.find((s) => num(s.season) === season && Array.isArray(s.episodes));
        if (known) return { episodes: known.episodes as unknown[] };
        const answer = asRecord(await tmdb.get(`/tv/${id}/season/${season}`));
        const episodes = (Array.isArray(answer.episodes) ? (answer.episodes as unknown[]) : []).map((e) => {
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
        payload.seasons = [...seasons.filter((s) => num(s.season) !== season), { season, episodes }];
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
        return {
          items: (Array.isArray(answer.results) ? (answer.results as unknown[]) : []).map((r) => rowOf(kind, asRecord(r))),
        };
      } catch (error) {
        return mapTitle404(error, titleId);
      }
    },

    /** Start a bulk sync (docs/03 section 7.6b). Single flight; `409 sync.busy` when one runs. */
    startSync(request: SyncRequest, actor: Actor): void {
      if (running !== null) throw new AppError(ERRORS.syncBusy, { startedAt: running.startedAt });
      running = { startedAt: now(), request, triggered: "admin" };
      recordSyncAudit("sync.started", actor, describeRequest(request));
      void runSync(request, "admin", actor)
        .then((titles) => {
          recordSyncAudit("sync.finished", actor, { ...describeRequest(request), titles });
        })
        .catch((error: unknown) => {
          recordSyncAudit("sync.failed", actor, {
            ...describeRequest(request),
            reason: error instanceof Error ? error.message : "failed",
          });
          lastRun = {
            finishedAt: now(),
            outcome: error instanceof Error ? error.message : "failed",
            titles: 0,
            triggered: "admin",
          };
        })
        .finally(() => {
          running = null;
        });
    },

    status(): SyncStatus & { omdb: { enabled: boolean; calls: number; limit: number } } {
      const { total, stale } = store.titles.counts(TITLE_FRESH_MS);
      return {
        running: running !== null,
        ...(running !== null && { startedAt: running.startedAt }),
        ...(lastRun !== null && { lastRunAt: lastRun.finishedAt, lastOutcome: lastRun.outcome }),
        titles: total,
        stale,
        schedule: formatSchedule(scheduleMs),
        omdb: omdb.quota(),
      };
    },

    /**
     * Arm the schedule hook (`TMDB_SYNC_SCHEDULE`): the system's only timer (`01` section 4.4). The
     * warm-up walks trending and popular for both kinds, `DEFAULT_SYNC_PAGES` each.
     */
    armSchedule(intervalMs: number): void {
      this.clearSchedule();
      stopped = false;
      scheduleMs = intervalMs;
      const warmup: SyncRequest[] = KINDS.flatMap((kind) => [
        { scope: "trending" as const, kind, pages: DEFAULT_SYNC_PAGES },
        { scope: "popular" as const, kind, pages: DEFAULT_SYNC_PAGES },
      ]);
      const tick = (): void => {
        scheduledChain = scheduledChain.then(async () => {
          for (const request of warmup) {
            if (running !== null) break;
            running = { startedAt: now(), request, triggered: "system" };
            recordSyncAudit("sync.started", {}, { ...describeRequest(request), triggered: "system" });
            try {
              const titles = await runSync(request, "system", {});
              recordSyncAudit("sync.finished", {}, { ...describeRequest(request), titles });
            } catch (error: unknown) {
              recordSyncAudit("sync.failed", {}, {
                ...describeRequest(request),
                reason: error instanceof Error ? error.message : "failed",
              });
              lastRun = {
                finishedAt: now(),
                outcome: error instanceof Error ? error.message : "failed",
                titles: 0,
                triggered: "system",
              };
            } finally {
              running = null;
            }
          }
        });
        scheduleTimer = setTimeout(tick, intervalMs);
      };
      tick();
    },

    clearSchedule(): void {
      stopped = true; // the in-flight runSync checks this between pages and leaves the store alone
      if (scheduleTimer !== undefined) clearTimeout(scheduleTimer);
      scheduleTimer = undefined;
      scheduleMs = undefined;
    },

    /** Test seam: resolves when no sync is running and the scheduled chain has settled. */
    async idle(): Promise<void> {
      while (running !== null) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      await scheduledChain;
    },
  };
}

function formatSchedule(intervalMs: number | undefined): string {
  if (intervalMs === undefined) return "off";
  if (intervalMs % 3_600_000 === 0) return `${intervalMs / 3_600_000}h`;
  if (intervalMs % 60_000 === 0) return `${intervalMs / 60_000}m`;
  if (intervalMs % 1_000 === 0) return `${intervalMs / 1_000}s`;
  return `${intervalMs}ms`;
}

export type TitleService = ReturnType<typeof createTitleService>;
