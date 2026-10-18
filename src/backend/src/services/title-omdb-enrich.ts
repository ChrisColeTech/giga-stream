import type { Store } from "../store/store.js";
import type { OmdbClient } from "./omdb-client.js";
import { type Kind, TITLE_FRESH_MS, asRecord, num, omdbBlockOf, str } from "./title-shapes.js";

/**
 * OMDb enrichment (docs/11 section 7.3): after TMDB's detail, once per title per freshness window, one call by IMDb
 * id, inside the daily budget. A miss, no id, or no key leaves the payload as it is.
 */
export function createOmdbEnricher(deps: { store: Store; omdb: OmdbClient; now: () => number }) {
  const { store, omdb, now } = deps;
  return async function enrichWithOmdb(kind: Kind, tmdbId: number, payload: Record<string, unknown>): Promise<void> {
    const imdbId = str(payload.imdbId);
    if (imdbId === undefined) return;
    const fetchedAt = num(asRecord(payload.omdb).fetchedAt);
    if (fetchedAt !== undefined && now() - fetchedAt < TITLE_FRESH_MS) return;
    const record = await omdb.get(imdbId);
    if (record === undefined) return;
    payload.omdb = omdbBlockOf(record, now());
    const stored = store.titles.find(kind, tmdbId);
    store.titles.put({
      kind,
      tmdbId,
      payload,
      popularityScore: stored?.popularityScore ?? null,
      popularityReadAt: stored?.popularityReadAt ?? null,
      fetchedAt: stored?.fetchedAt ?? now(),
    });
  };
}
