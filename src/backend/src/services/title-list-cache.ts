import type { Store } from "../store/store.js";
import { type BrowseQuery, type Kind, asRecord, num, storedRowOf } from "./title-shapes.js";

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

/** Read a complete list snapshot. One absent or malformed member invalidates the snapshot. */
export function storedListItems(
  store: Store,
  kind: Kind,
  ids: number[],
): Record<string, unknown>[] | undefined {
  const items: Record<string, unknown>[] = [];
  for (const id of ids) {
    const found = store.titles.find(kind, id);
    const payload = asRecord(found?.payload);
    const listRow = payload.shape === "detail" ? payload.listSnapshot : found?.payload;
    const row = found && storedRowOf(kind, id, listRow, found.popularityReadAt ?? found.fetchedAt);
    if (row === undefined) return undefined;
    items.push(row);
  }
  return items;
}

/** Store shaped list members without replacing a valid full detail already in the cache. */
export function storeListItems(store: Store, kind: Kind, rows: Record<string, unknown>[], fetchedAt: number): void {
  for (const row of rows) {
    const tmdbId = num(row.tmdbId);
    if (tmdbId === undefined) continue;
    const existing = store.titles.find(kind, tmdbId);
    const validExisting = existing
      && storedRowOf(kind, tmdbId, existing.payload, existing.popularityReadAt ?? existing.fetchedAt);
    const keepDetail = validExisting !== undefined && asRecord(existing?.payload).shape === "detail";
    const payload = keepDetail && existing !== undefined ? { ...asRecord(existing.payload), listSnapshot: row } : row;
    const titleFetchedAt = keepDetail && existing !== undefined ? existing.fetchedAt : fetchedAt;
    store.titles.put({
      kind,
      tmdbId,
      payload,
      popularityScore: num(asRecord(row.popularity).score) ?? null,
      popularityReadAt: fetchedAt,
      fetchedAt: titleFetchedAt,
    });
  }
}
