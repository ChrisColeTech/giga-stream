import { AppError, ERRORS } from "../constants/errors.js";
import { StoredTitleSchema } from "./title-row-schema.js";

/** Freshness (docs/03 sections 7.6, 7.6b): days for titles, hours for lists and popularity. */
export const TITLE_FRESH_MS = 3 * 24 * 60 * 60 * 1000;
export const LIST_FRESH_MS = 8 * 60 * 60 * 1000;
export const DEFAULT_SYNC_PAGES = 5;
export const MAX_SYNC_PAGES = 25;
/** The discover walk's per-kind page caps (docs/03 section 7.6b): 500 pages ≈ 10,000 titles per kind. */
export const DEFAULT_DISCOVER_PAGES = 100;
export const MAX_DISCOVER_PAGES = 500;

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
  scope: "trending" | "popular" | "discover" | "titles";
  kind?: Kind;
  pages?: number;
  /** Title ids (`movie-603`, `tv-1399`): the kind comes with the id (docs/26 section 3.10, rule 6). */
  ids?: string[];
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

export interface ListAnswer {
  items: Record<string, unknown>[];
  page: number;
  totalPages: number;
  totalResults: number;
  skipped?: number; // rows of this page left out (deleted or disabled titles): a thinned page, not the end
}

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
export const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
export const str = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);
export const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);
const nonBlank = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
const tmdbTitleOf = (kind: Kind, value: Record<string, unknown>): string | undefined =>
  nonBlank(kind === "movie" ? value.title : value.name);
const yearOf = (date: unknown): number | undefined => {
  const year = Number(str(date)?.slice(0, 4));
  return Number.isInteger(year) && year > 1800 ? year : undefined;
};
const image = (path: unknown, size: string): string | undefined =>
  str(path) ? `https://image.tmdb.org/t/p/${size}${String(path)}` : undefined;

/** TMDB answering `404` for a title is `title.not_found` (docs/03 section 7.4), not an outage. */
export function mapTitle404(error: unknown, titleId: string): never {
  if (error instanceof AppError && error.details?.status === 404) throw new AppError(ERRORS.titleNotFound, { titleId });
  throw error;
}

export const parseTitleId = (titleId: string): [Kind, number] => {
  const match = /^(movie|tv)-(\d+)$/.exec(titleId);
  if (!match?.[2]) throw new AppError(ERRORS.titleNotFound, { titleId });
  return [match[1] === "tv" ? "tv" : "movie", Number(match[2])];
};

export const titleIdOf = (kind: Kind, tmdbId: number): string => `${kind}-${tmdbId}`;

/** The one sync schedule parser: "6h", "30m", "45s", "500ms"; empty or "off" means disabled. */
export function parseSchedule(value: string, field = "TMDB_SYNC_SCHEDULE"): number | undefined {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "" || trimmed === "off") return undefined;
  const match = /^(\d+)(ms|s|m|h)$/.exec(trimmed);
  if (!match?.[1]) throw new AppError(ERRORS.requestInvalid, { field }, "That sync schedule is not valid.");
  const n = Number(match[1]);
  return match[2] === "h" ? n * 3_600_000 : match[2] === "m" ? n * 60_000 : match[2] === "s" ? n * 1_000 : n;
}

export function formatSchedule(intervalMs: number | undefined): string {
  if (intervalMs === undefined) return "off";
  if (intervalMs % 3_600_000 === 0) return `${intervalMs / 3_600_000}h`;
  if (intervalMs % 60_000 === 0) return `${intervalMs / 60_000}m`;
  if (intervalMs % 1_000 === 0) return `${intervalMs / 1_000}s`;
  return `${intervalMs}ms`;
}

/** A series' seasons from TMDB's answer, mapped to the detail contract (docs/03 section 7.4): `season_number` becomes
 *  `season`, `episode_count` becomes `episodeCount`; the specials (season 0) and empty seasons are left out, in TMDB's
 *  order. A later season read replaces an entry with its episodes (`title-reads.seasons`). */
function seasonsOf(kind: Kind, answer: Record<string, unknown>): Array<{ season: number; episodeCount: number }> {
  return listOf(answer.seasons).flatMap((entry) => {
    const season = num(asRecord(entry).season_number);
    const episodeCount = num(asRecord(entry).episode_count);
    return kind !== "tv" || season === undefined || season < 1 || episodeCount === undefined || episodeCount <= 0
      ? []
      : [{ season, episodeCount }];
  });
}

/** A full TMDB record (with `credits,external_ids` appended) as the stored detail payload. */
export function detailOf(kind: Kind, tmdbId: number, answer: Record<string, unknown>): Record<string, unknown> {
  const title = tmdbTitleOf(kind, answer);
  if (title === undefined) throw new AppError(ERRORS.tmdbUnavailable, { reason: `answer without a ${kind} title` });
  const castList = listOf(asRecord(answer.credits).cast);
  const runtime = num(answer.runtime);
  const seasons = seasonsOf(kind, answer);
  return {
    id: titleIdOf(kind, tmdbId),
    tmdbId,
    kind,
    shape: "detail" as const,
    title,
    year: yearOf(answer.release_date) ?? yearOf(answer.first_air_date),
    genres: listOf(answer.genres).map((g) => str(asRecord(g).name) ?? "").filter((name) => name !== ""),
    rating: num(answer.vote_average),
    posterUrl: image(answer.poster_path, "w500"),
    backdropUrl: image(answer.backdrop_path, "w1280"),
    plot: str(answer.overview),
    cast: castList.slice(0, 10).map((c) => str(asRecord(c).name) ?? "").filter((name) => name !== ""),
    runtimeMs: runtime !== undefined ? runtime * 60_000 : undefined,
    status: str(answer.status),
    imdbId: str(answer.imdb_id) ?? str(asRecord(answer.external_ids).imdb_id),
    ...(seasons.length > 0 && { seasons }),
  };
}

/** A thin list row: the detail route enriches it when the title is opened. */
export function rowOf(kind: Kind, tmdb: Record<string, unknown>, now: number): Record<string, unknown> | undefined {
  const tmdbId = num(tmdb.id);
  const title = tmdbTitleOf(kind, tmdb);
  if (tmdbId === undefined || !Number.isInteger(tmdbId) || tmdbId <= 0 || title === undefined) return undefined;
  const popularity = num(tmdb.popularity);
  return {
    id: titleIdOf(kind, tmdbId),
    tmdbId,
    kind,
    shape: "list" as const,
    title,
    year: yearOf(tmdb.release_date) ?? yearOf(tmdb.first_air_date),
    genres: listOf(tmdb.genre_ids).map(String),
    rating: num(tmdb.vote_average),
    posterUrl: image(tmdb.poster_path, "w500"),
    backdropUrl: image(tmdb.backdrop_path, "w1280"),
    ...(popularity !== undefined && { popularity: { score: popularity, readAt: now } }),
  };
}

export function rowsOf(kind: Kind, values: unknown[], now: number): Record<string, unknown>[] {
  return values.map((value) => rowOf(kind, asRecord(value), now)).filter((row) => row !== undefined);
}

/** Validate a stored output row, or safely reshape a legacy raw TMDB list row. */
export function storedRowOf(
  kind: Kind, tmdbId: number, payload: unknown, readAt: number,
): Record<string, unknown> | undefined {
  const record = asRecord(payload);
  if (record.id === titleIdOf(kind, tmdbId) && record.kind === kind && num(record.tmdbId) === tmdbId) {
    const parsed = StoredTitleSchema.safeParse(record);
    return parsed.success ? parsed.data : undefined;
  }
  if (num(record.id) !== tmdbId) return undefined;
  return rowOf(kind, record, readAt);
}

/** The OMDb block of docs/11 section 7.2: only the fields the product shows, `Plot` kept raw. */
export function omdbBlockOf(record: Record<string, unknown>, now: number): Record<string, unknown> {
  return {
    fetchedAt: now,
    rated: str(record.Rated),
    metascore: str(record.Metascore),
    imdbRating: str(record.imdbRating),
    imdbVotes: str(record.imdbVotes),
    ratings: listOf(record.Ratings)
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
