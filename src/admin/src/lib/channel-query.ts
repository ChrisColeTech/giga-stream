import { nextSort, type SortDir } from "@giga/ui/lists/record-grid-sort";
import { PAGE_SIZE } from "@giga/ui/lib/window-constants";

/* The Channels list's query (`41` sections 3.1 and 6), pure: what the person asked for (search, filters, sort), the
 * stable key a result is checked against, and the request path of one page. The list is the backend's, so every part of
 * it is a parameter of `GET /api/admin-channels`; nothing is filtered in the browser. */

export type ChannelSortKey = "name" | "category" | "kind" | "playlist";
export type KindFilter = "all" | "live" | "stream";
export type OriginFilter = "all" | "synced" | "edited" | "manual";
export type EnabledFilter = "all" | "true" | "false";
/** The sync's verdict on a stream row's address; `unchecked` is `not checked` in the list. */
export type StatusFilter = "all" | "live" | "dead" | "unchecked";
export type LiveStateFilter = "all" | "preparing" | "starting" | "live" | "restarting" | "stopped" | "failed";

export interface ChannelQuery {
  /** Case-insensitive contains over name, number, tvg-id and the playlist's name and host. */
  readonly q: string;
  readonly kind: KindFilter;
  readonly origin: OriginFilter;
  readonly enabled: EnabledFilter;
  readonly state: LiveStateFilter;
  /** The stream status of a stream row (`43` section 3.3); a live-kind row has none. */
  readonly status: StatusFilter;
  /** A playlist's id, as the select holds it: the channels that playlist created. Empty is every playlist. */
  readonly playlist: string;
  readonly sort: ChannelSortKey;
  readonly dir: SortDir;
}

/** By name, ascending: there is no guide, so no number (owner, 2026-10-17). */
export const DEFAULT_CHANNEL_QUERY: ChannelQuery = {
  q: "",
  kind: "all",
  origin: "all",
  enabled: "all",
  state: "all",
  status: "all",
  playlist: "",
  sort: "name",
  dir: "asc",
};

export const CHANNEL_SORT_KEYS: readonly ChannelSortKey[] = ["name", "category", "kind", "playlist"];

export const isSortKey = (key: string): key is ChannelSortKey => CHANNEL_SORT_KEYS.some((one) => one === key);

/** The same query, to the byte: a result for another key is dropped, and a key change scrolls the list to the top. */
export const queryKey = (query: ChannelQuery): string =>
  [query.q, query.kind, query.origin, query.enabled, query.state, query.status, query.playlist, query.sort, query.dir]
    .join("\u0001");

export const isDefaultQuery = (query: ChannelQuery): boolean => queryKey(query) === queryKey(DEFAULT_CHANNEL_QUERY);

/** A filter changed. `state` only exists on live rows and `origin` and `status` only on stream rows, so choosing one
 *  clears the filter that contradicts it (the backend would answer nothing). */
export function withFilter<K extends "kind" | "origin" | "enabled" | "state" | "status">(
  query: ChannelQuery,
  field: K,
  value: ChannelQuery[K],
): ChannelQuery {
  const next: ChannelQuery = { ...query, [field]: value };
  if (field === "state" && value !== "all") return { ...next, kind: "live", origin: "all", status: "all", playlist: "" };
  if (field === "origin" && value !== "all") return { ...next, kind: "stream", state: "all" };
  if (field === "status" && value !== "all") return { ...next, kind: "stream", state: "all" };
  if (field === "kind" && value === "live") return { ...next, origin: "all", status: "all", playlist: "" };
  if (field === "kind" && value === "stream") return { ...next, state: "all" };
  return next;
}

/** The Playlist select: a playlist's id, or `""` for every playlist. A playlist's channels are stream rows, so choosing
 *  one clears a Live kind and a live-engine State (the backend would answer nothing). */
export function withPlaylist(query: ChannelQuery, playlist: string): ChannelQuery {
  const next: ChannelQuery = { ...query, playlist };
  return playlist === "" ? next : { ...next, kind: next.kind === "live" ? "all" : next.kind, state: "all" };
}

/** The Channels list as one playlist's channels (`Channels →` on a playlist workspace): the default query, narrowed. */
export const queryOfPlaylist = (id: number): ChannelQuery => ({ ...DEFAULT_CHANNEL_QUERY, playlist: String(id) });

export const withSearch =(query: ChannelQuery, q: string): ChannelQuery => ({ ...query, q: q.trim() });

/** The Sort select: the column changes, the direction stays. */
export const withSortKey = (query: ChannelQuery, sort: ChannelSortKey): ChannelQuery => ({ ...query, sort });

export const withDirection = (query: ChannelQuery, dir: SortDir): ChannelQuery => ({ ...query, dir });

/** A press on a sortable heading: the first press sorts ascending, the second descending. */
export function pressHeading(query: ChannelQuery, key: string): ChannelQuery {
  if (!isSortKey(key)) return query;
  const next = nextSort({ key: query.sort, dir: query.dir }, key);
  return { ...query, sort: key, dir: next.dir };
}

/** `/api/admin-channels?limit=100&offset=0&...`: only the parameters that are set. `limit` turns paging on. */
export function pagePath(query: ChannelQuery, pageIndex: number, limit: number = PAGE_SIZE): string {
  const params = new URLSearchParams({ limit: String(limit), offset: String(Math.max(0, pageIndex) * limit) });
  if (query.q !== "") params.set("q", query.q);
  if (query.kind !== "all") params.set("kind", query.kind);
  if (query.origin !== "all") params.set("origin", query.origin);
  if (query.enabled !== "all") params.set("enabled", query.enabled);
  if (query.state !== "all") params.set("state", query.state);
  if (query.status !== "all") params.set("status", query.status);
  if (query.playlist !== "") params.set("playlist", query.playlist);
  params.set("sort", query.sort);
  params.set("dir", query.dir);
  return `/api/admin-channels?${params.toString()}`;
}

/** Every live channel, at the backend's largest page: the few rows the statusbar's `N preparing` is counted over. */
export const LIVE_ROWS_PATH = "/api/admin-channels?limit=200&offset=0&kind=live&sort=name&dir=asc";
