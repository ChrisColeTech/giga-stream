import type { Store } from "../store/store.js";
import { type Kind, asRecord, num, storedRowOf } from "./title-shapes.js";

/** Read a complete list snapshot. One absent or malformed member invalidates the snapshot. */
export function storedListItems(
  store: Store,
  kind: Kind,
  ids: number[],
): Record<string, unknown>[] | undefined {
  const items: Record<string, unknown>[] = [];
  for (const id of ids) {
    const found = store.titles.find(kind, id);
    const row = found && storedRowOf(kind, id, found.payload, found.popularityReadAt ?? found.fetchedAt);
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
    const payload = keepDetail && existing !== undefined ? existing.payload : row;
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
