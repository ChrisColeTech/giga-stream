import type { Store } from "../store/store.js";
import type { StoredTitle } from "../store/title-repository.js";
import type { CatalogPage, CatalogQuery, CatalogTitle } from "../types/title-catalog.js";
import { StoredTitleSchema } from "./title-row-schema.js";

// A hand-made title may have no TMDB id; every other stored-title rule holds.
const CatalogPayload = StoredTitleSchema.partial({ tmdbId: true });

/** A stored row as a catalog row, or undefined when its payload fails the stored-title schema. */
function itemOf(row: StoredTitle): CatalogTitle | undefined {
  const parsed = CatalogPayload.safeParse(row.payload);
  if (!parsed.success) return undefined;
  const p = parsed.data;
  const popularity = p.popularity?.score ?? row.popularityScore ?? undefined;
  return {
    id: row.id,
    kind: row.kind,
    title: p.title,
    ...(p.year !== undefined && { year: p.year }),
    ...(p.rating !== undefined && { rating: p.rating }),
    ...(popularity !== undefined && { popularity }),
    ...(p.posterUrl !== undefined && { posterUrl: p.posterUrl }),
    ...(p.backdropUrl !== undefined && { backdropUrl: p.backdropUrl }),
    genres: p.genres,
  };
}

/**
 * The fileserver's sync read (docs/03 section 7.4): enabled titles in `id` order from the store alone. It never asks
 * TMDB. `next` is the last row read when more follow, so a page of skipped rows still moves the cursor on.
 */
export function createTitleCatalog(store: Store) {
  return {
    async page(query: CatalogQuery): Promise<CatalogPage> {
      const rows = await store.titles.catalog(query.after, query.limit + 1);
      const more = rows.length > query.limit;
      const kept = more ? rows.slice(0, query.limit) : rows;
      const items = kept.flatMap((row) => itemOf(row) ?? []);
      const last = kept[kept.length - 1];
      return { items, ...(more && last !== undefined && { next: last.id }) };
    },
  };
}

export type TitleCatalog = ReturnType<typeof createTitleCatalog>;
