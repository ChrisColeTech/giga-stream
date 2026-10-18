/** The cached titles' shapes (docs/46 sections A and B). Display and load fields only: never a stream address or sources. */
import type { TitleKind, TitleSort } from "../services/admin-titles.js";

/** One season of a series as the cache keeps it: the count shown in the Player's season list. */
export interface SeasonCount {
  season: number;
  episodeCount: number;
}

/** One row of the backend's catalog read (docs/03 section 7.4); `genres` are decoded names (or names kept as sent). */
export interface CatalogItem {
  id: string;
  kind: TitleKind;
  title: string;
  year?: number;
  rating?: number;
  popularity?: number;
  posterUrl?: string;
  backdropUrl?: string;
  genres: string[];
}

/** A cached title: the list columns, and the detail columns once a title was opened. Addresses are the sources. */
export interface CachedTitle extends CatalogItem {
  plot?: string;
  cast?: string[];
  runtimeMs?: number;
  seasons?: SeasonCount[];
  /** When the detail columns were last written through. */
  detailAt?: number;
}

/** What a live detail read writes through: the display fields only (the caller never passes sources or a stream). */
export interface DetailWrite {
  id: string;
  kind: TitleKind;
  title: string;
  year?: number;
  rating?: number;
  posterUrl?: string;
  backdropUrl?: string;
  genres: string[];
  plot?: string;
  cast: string[];
  runtimeMs?: number;
  seasons: SeasonCount[];
  at: number;
}

/** One entry of the genre dictionary of a kind (TMDB's list). */
export interface GenreEntry {
  id: number;
  name: string;
}

/** What narrows the cached titles (docs/46 section A): `q` is a `LIKE` over the title. */
export interface TitleFilter {
  kinds: readonly TitleKind[];
  q?: string;
  /** A title matches any of these. */
  genres: readonly string[];
  year?: number;
  /** Only titles with no watch entry. */
  unwatched: boolean;
}

export interface TitlePageRequest extends TitleFilter {
  sort: TitleSort;
  offset: number;
  limit: number;
}

export interface TitlePageResult {
  rows: CachedTitle[];
  /** Every cached title the filter matches, whatever the page. */
  total: number;
}
