import type { Store } from "../store/store.js";
import type { StoredTitle } from "../store/title-repository.js";
import type { StoredTitleFilter, StoredTitleRow, StoredTitlesPage, StoredTitlesQuery } from "../types/title-stored.js";
import { stateOf } from "./title-overlay.js";
import { asRecord, num, str } from "./title-shapes.js";

const stringsOf = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;

/** A stored record as a list row: the admin's title row (docs/29 section 5), never a series' seasons. */
function rowOf(row: StoredTitle): StoredTitleRow {
  const payload = asRecord(row.payload);
  const optional = {
    year: num(payload.year),
    rating: num(payload.rating),
    genres: stringsOf(payload.genres),
    posterUrl: str(payload.posterUrl),
    backdropUrl: str(payload.backdropUrl),
    tmdbId: row.tmdbId ?? undefined,
    streamUrl: str(payload.streamUrl),
  };
  const present = Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined));
  return {
    id: row.id,
    kind: row.kind,
    title: str(payload.title) ?? row.id,
    ...present,
    state: stateOf(row),
    enabled: row.enabled,
    editedFields: row.editedFields,
    fetchedAt: row.fetchedAt,
  };
}

/**
 * The stored titles (docs/41 section 3.2): every row of the backend's `titles` table, synced and made by hand, read
 * from the store alone. It never asks TMDB, so it answers the same with TMDB absent or unreachable.
 */
export function createStoredTitles(store: Store) {
  return {
    page(query: StoredTitlesQuery): StoredTitlesPage {
      const filter: StoredTitleFilter = {
        ...(query.q !== undefined && { q: query.q }),
        ...(query.kind !== "all" && { kind: query.kind }),
        ...(query.origin !== "all" && { origin: query.origin }),
        ...(query.edited !== undefined && { edited: query.edited }),
        ...(query.enabled !== undefined && { enabled: query.enabled }),
      };
      const { rows, total } = store.titles.page(filter, query.sort, query.dir, query.limit, query.offset);
      const { counts, version } = store.titles.inventory();
      return { items: rows.map(rowOf), total, offset: query.offset, limit: query.limit, inventory: counts, version };
    },
  };
}

export type StoredTitles = ReturnType<typeof createStoredTitles>;
