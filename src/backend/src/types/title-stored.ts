import { z } from "zod";

import { LIST_OFFSET_MAX, LIST_PAGE_DEFAULT, LIST_PAGE_MAX, TITLE_SEARCH_MAX } from "../constants/limits.js";

export const STORED_SORTS = ["title", "year", "rating", "fetched"] as const;
export type StoredSort = (typeof STORED_SORTS)[number];

const flag = z.enum(["true", "false"]).optional().transform((value) => (value === undefined ? undefined : value === "true"));

/** The query of `GET /api/titles/stored` (docs/41 section 3.2). An empty search is no search. */
export const StoredTitlesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX).default(LIST_PAGE_DEFAULT),
  offset: z.coerce.number().int().min(0).max(LIST_OFFSET_MAX).default(0),
  q: z.string().trim().max(TITLE_SEARCH_MAX).optional().transform((value) => (value === "" ? undefined : value)),
  kind: z.enum(["movie", "tv", "all"]).default("all"),
  origin: z.enum(["tmdb", "manual", "all"]).default("all"),
  edited: flag,
  enabled: flag,
  sort: z.enum(STORED_SORTS).default("title"),
  dir: z.enum(["asc", "desc"]).default("asc"),
});
export type StoredTitlesQuery = z.infer<typeof StoredTitlesQuerySchema>;

/** What the repository filters on; `all` is no filter. */
export interface StoredTitleFilter {
  q?: string;
  kind?: "movie" | "tv";
  origin?: "tmdb" | "manual";
  edited?: boolean;
  enabled?: boolean;
}

/** The whole store's counts, whatever the filters: the heading readout (`10,921 stored`). */
export interface TitleInventory {
  movie: number;
  tv: number;
  manual: number;
  edited: number;
  disabled: number;
}

/** One row of the stored list: the admin's title row (docs/29 section 5) and when it was stored or refreshed. */
export interface StoredTitleRow {
  id: string;
  kind: "movie" | "tv";
  title: string;
  year?: number;
  rating?: number;
  genres?: string[];
  posterUrl?: string;
  backdropUrl?: string;
  tmdbId?: number;
  streamUrl?: string;
  state: "synced" | "edited" | "manual";
  enabled: boolean;
  editedFields: string[];
  fetchedAt: number;
}

export interface StoredTitlesPage {
  items: StoredTitleRow[];
  total: number;
  offset: number;
  limit: number;
  inventory: TitleInventory;
  /** `count:max(fetched_at)` of the whole table: the set's change marker (docs/41 section 4.3). */
  version: string;
}
