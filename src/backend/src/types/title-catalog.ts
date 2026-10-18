import { z } from "zod";

import { CATALOG_PAGE_DEFAULT, CATALOG_PAGE_MAX } from "../constants/limits.js";

/** The query of `GET /api/titles/catalog` (docs/03 section 7.4): the keyset cursor and the page size. */
export const CatalogQuerySchema = z.object({
  after: z.string().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(CATALOG_PAGE_MAX).default(CATALOG_PAGE_DEFAULT),
});
export type CatalogQuery = z.infer<typeof CatalogQuerySchema>;

/** One catalog row: the thin public fields only; never an address of a stream, its sources, `enabled`, plot or cast. */
export interface CatalogTitle {
  id: string;
  kind: "movie" | "tv";
  title: string;
  year?: number;
  rating?: number;
  popularity?: number;
  posterUrl?: string;
  backdropUrl?: string;
  genres: string[];
}

export interface CatalogPage {
  items: CatalogTitle[];
  /** The id to pass as `after` for the next page; absent on the last page. */
  next?: string;
}
