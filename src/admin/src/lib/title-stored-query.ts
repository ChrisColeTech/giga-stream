import { PAGE_SIZE } from "@giga/ui/lib/window-constants";

/* The Stored titles list's query (`docs/41` sections 3.2 and 6), pure. It is exactly the contract of
 * `GET /api/titles/stored`: `q`, `kind`, `origin`, `edited`, `enabled`, `sort`, `dir`, then `limit` and `offset`. The
 * search runs on Enter (`typed` is the field's text, `q` the search that was run); a filter or a sort is a new query,
 * which resets the list to the top. The key is the query without its page, so an answer for an older query is dropped. */

export type StoredSort = "title" | "year" | "rating" | "fetched";
export type StoredDir = "asc" | "desc";
export type StoredKind = "all" | "movie" | "tv";
export type StoredOrigin = "all" | "tmdb" | "manual";
export type StoredFlag = "all" | "true" | "false";

export interface StoredQuery {
  readonly q: string;
  readonly kind: StoredKind;
  readonly origin: StoredOrigin;
  readonly edited: StoredFlag;
  readonly enabled: StoredFlag;
  readonly sort: StoredSort;
  readonly dir: StoredDir;
}

export const START_STORED: StoredQuery = {
  q: "",
  kind: "all",
  origin: "all",
  edited: "all",
  enabled: "all",
  sort: "title",
  dir: "asc",
};

/** The sort Select's values: the column and its direction, `year:desc`. */
export const STORED_SORT_VALUES = [
  "title:asc",
  "title:desc",
  "year:desc",
  "year:asc",
  "rating:desc",
  "rating:asc",
  "fetched:desc",
  "fetched:asc",
] as const;
export type StoredSortValue = (typeof STORED_SORT_VALUES)[number];

export const sortValueOf = (query: StoredQuery): string => `${query.sort}:${query.dir}`;

/** The query after the sort Select changed; an unknown value changes nothing. */
export function withSortValue(query: StoredQuery, value: string): StoredQuery {
  const known = STORED_SORT_VALUES.find((one) => one === value);
  if (known === undefined) return query;
  const [sort, dir] = known.split(":");
  return { ...query, sort: sort as StoredSort, dir: dir as StoredDir };
}

/** One page's URL search part. `limit` is 1 to 200 on the backend; `offset` is the first row's index. */
export function storedParams(query: StoredQuery, offset: number, limit: number = PAGE_SIZE): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (query.q !== "") params.set("q", query.q);
  params.set("kind", query.kind);
  params.set("origin", query.origin);
  if (query.edited !== "all") params.set("edited", query.edited);
  if (query.enabled !== "all") params.set("enabled", query.enabled);
  params.set("sort", query.sort);
  params.set("dir", query.dir);
  return params.toString();
}

/** The query as a stable key: an answer carries the key it was asked for. */
export const storedKey = (query: StoredQuery): string => storedParams(query, 0, 0);

/** The run search: the typed text, trimmed. */
export const withSearch = (query: StoredQuery, typed: string): StoredQuery => ({ ...query, q: typed.trim() });

/** True when anything but the default order narrows or reorders the list. */
export const isDefaultQuery = (query: StoredQuery): boolean => storedKey(query) === storedKey(START_STORED);
