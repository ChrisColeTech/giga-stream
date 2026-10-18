import type { Store } from "../store/store.js";
import type { TitleDeleted } from "./title-deleted.js";
import { type Kind, TITLE_FRESH_MS, asRecord, num, rowOf, storedRowOf } from "./title-shapes.js";

/** The fields a list row refreshes on a stored full-detail payload; everything else stays the detail's. */
const REFRESHED = ["rating", "posterUrl", "backdropUrl"] as const;

/**
 * One TMDB list row into the store (docs/03 section 7.6b, docs/44 section 3.5). A title the admin deleted stays out. A
 * fresh stored payload stands. A stale one that is a full detail (`shape: "detail"`) is kept, not overwritten by the
 * thin row: only its rating, poster and backdrop are refreshed, and its shape and `fetchedAt` stay (so opening it does
 * not cost a TMDB and an OMDb call again). Anything else becomes the thin row. The popularity is always read.
 * Answers whether the row was stored.
 */
export function createStoreRow(deps: { store: Store; deleted: Pick<TitleDeleted, "isDeleted">; now: () => number }) {
  const { store, deleted, now } = deps;

  return function storeRow(kind: Kind, record: Record<string, unknown>): boolean {
    const id = num(record.id);
    if (id === undefined || deleted.isDeleted(kind, id)) return false;
    const shaped = rowOf(kind, record, now());
    if (shaped === undefined) return false;
    const existing = store.titles.find(kind, id);
    const kept = existing === undefined
      ? undefined
      : storedRowOf(kind, id, existing.payload, existing.popularityReadAt ?? existing.fetchedAt);
    const fresh = existing !== undefined && kept !== undefined && now() - existing.fetchedAt < TITLE_FRESH_MS;
    const detail = existing !== undefined && kept?.shape === "detail";
    let payload = shaped;
    if (fresh) payload = asRecord(existing.payload);
    else if (detail) {
      // The list face a detail keeps (`listSnapshot`, which browse lists show) is refreshed alike.
      const face = asRecord(asRecord(existing.payload).listSnapshot);
      payload = { ...asRecord(existing.payload) };
      const faceNow = Object.keys(face).length > 0 ? { ...face } : undefined;
      for (const field of REFRESHED) {
        if (shaped[field] === undefined) continue;
        payload[field] = shaped[field];
        if (faceNow !== undefined) faceNow[field] = shaped[field];
      }
      if (faceNow !== undefined) payload.listSnapshot = faceNow;
    }
    const popularity = num(record.popularity);
    store.titles.put({
      kind,
      tmdbId: id,
      payload,
      popularityScore: popularity ?? existing?.popularityScore ?? null,
      popularityReadAt: popularity !== undefined ? now() : existing?.popularityReadAt ?? null,
      fetchedAt: fresh || detail ? existing.fetchedAt : now(),
    });
    return true;
  };
}

export type StoreRow = ReturnType<typeof createStoreRow>;
