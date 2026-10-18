import { AppError, ERRORS } from "../constants/errors.js";
import { TMDB_APPEND_MAX } from "../constants/limits.js";
import type { Store } from "../store/store.js";
import type { TmdbClient } from "./tmdb-client.js";
import { keepEpisodes, mergeSeasons, seasonsMissing } from "./title-episodes.js";
import { type Kind, TITLE_FRESH_MS, asRecord, detailOf, num, titleIdOf } from "./title-shapes.js";

/**
 * Whether a TMDB failure belongs to one title (a `404` for a removed title, another refusal of that one request, or an
 * answer without a title) rather than to the service: the Library fill records it and goes on. An outage, a `429`
 * or a `5xx` that outlived the client's bounded backoff ends the run instead.
 */
export function isRowFailure(error: unknown): boolean {
  if (!(error instanceof AppError) || error.code !== ERRORS.tmdbUnavailable.code) return false;
  const status = error.details?.status;
  if (typeof status === "number") return status >= 400 && status < 500 && status !== 429;
  return typeof error.details?.reason === "string" && error.details.reason.startsWith("answer without");
}

/** What one fetch wrote: the stored payload and how many seasons received their episodes. */
export interface Fetched {
  payload: Record<string, unknown>;
  seasons: number;
}

export interface FetchOptions {
  signal?: AbortSignal;
  /** A title deleted while the call was in flight is not stored again. */
  mustExist?: boolean;
  /** Take the detail again even when the stored one is fresh (an admin's add or revert). */
  force?: boolean;
  /** A detail or a season's episodes read before this are stale; default `TITLE_FRESH_MS` ago. */
  staleBefore?: number;
}

const appended = (seasons: readonly number[]): string[] => seasons.map((n) => `season/${n}`);

/**
 * The one place a title's TMDB detail is fetched and stored (docs/47 section 3.1): the Library fill's `details` phase,
 * an admin's add (`POST /api/titles/from-tmdb`) and a revert. A movie is one `/movie/{id}` call with the credits and
external ids, mapped by `detailOf`. A series is `/tv/{id}` with `append_to_response=credits,external_ids,season/1,...`
 * - TMDB allows 20 appended items, so the first call of any series (seen before or not) carries seasons 1 to 18, a known
 * series only the ones it still lacks; seasons above 18 get follow-up calls of up to 20 `season/N` appends; the season answers become `seasons[n].episodes` and everything is written in ONE short
 * transaction. A series whose detail is fresh but whose seasons lack episodes asks for just the missing seasons. A
 * `season/N` the answer does not carry is left for the next run. An admin's edited fields and a series' stored episodes
 * are kept. Nothing is asked of OMDb.
 */
export function createDetailFetch(deps: { store: Store; tmdb: TmdbClient; now: () => number }) {
  const { store, tmdb, now } = deps;
  return async function fetchDetail(kind: Kind, tmdbId: number, options: FetchOptions = {}): Promise<Fetched | undefined> {
    const call = async (append: string[]): Promise<Record<string, unknown>> => {
      const params = append.length > 0 ? { append_to_response: append.join(",") } : {};
      return asRecord(await tmdb.get(`/${kind}/${tmdbId}`, params, options.signal ? { signal: options.signal } : {}));
    };
    const existing = store.titles.find(kind, tmdbId);
    const prior = asRecord(existing?.payload);
    const staleBefore = options.staleBefore ?? now() - TITLE_FRESH_MS;
    const wholeDetail = options.force === true || existing === undefined || prior.shape !== "detail" || existing.fetchedAt < staleBefore;
    const base = wholeDetail ? ["credits", "external_ids"] : [];
    // A series not seen as a detail yet has no season list to ask by, so its first call asks for seasons 1 to 18 blind:
    // TMDB answers 200 with only the `season/N` keys that exist (verified against the real API). Seasons above 18 follow
    // in calls of up to 20, decided from the answer's own `seasons[]`.
    const blind = Array.from({ length: TMDB_APPEND_MAX - base.length }, (_, i) => i + 1);
    const wanted = kind !== "tv" ? [] : !Array.isArray(prior.seasons) ? blind : seasonsMissing(prior, staleBefore);
    const first = wanted.slice(0, TMDB_APPEND_MAX - base.length);
    if (base.length === 0 && first.length === 0) return undefined;
    const answer = await call([...base, ...appended(first)]);
    const payload = wholeDetail ? detailOf(kind, tmdbId, answer) : { ...prior };
    if (wholeDetail) {
      keepEpisodes(payload, prior);
      if (prior.omdb !== undefined) payload.omdb = prior.omdb; // OMDb's block is the OMDb step's, not TMDB's to drop
    }
    let seasons = kind === "tv" ? mergeSeasons(payload, answer, now()) : 0;
    const asked = new Set(first);
    while (kind === "tv") {
      const more = seasonsMissing(payload, staleBefore).filter((n) => !asked.has(n)).slice(0, TMDB_APPEND_MAX);
      if (more.length === 0) break;
      for (const n of more) asked.add(n);
      seasons += mergeSeasons(payload, await call(appended(more)), now());
    }
    return store.transaction(() => {
      const current = store.titles.find(kind, tmdbId);
      if (options.mustExist === true && current === undefined) return undefined;
      store.titles.put({
        kind,
        tmdbId,
        payload,
        popularityScore: wholeDetail ? (num(answer.popularity) ?? null) : (existing?.popularityScore ?? null),
        popularityReadAt: wholeDetail ? now() : (existing?.popularityReadAt ?? null),
        fetchedAt: wholeDetail ? now() : (existing?.fetchedAt ?? now()),
      });
      store.titles.queue.clearDetailFailure(titleIdOf(kind, tmdbId));
      return { payload, seasons };
    });
  };
}

export type DetailFetch = ReturnType<typeof createDetailFetch>;
