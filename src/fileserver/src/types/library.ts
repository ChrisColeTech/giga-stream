/** The library query and the titles pass-through (docs/03 sections 3.5 and 3.6). */
import type { ItemRef } from "./collection.js";

/** One playable provider source, filled by the backend (docs/03 sections 3.6 and 7.5). */
export interface TitleSource {
  providerId: number;
  /** The display name ("VidSrc"). */
  name: string;
  /** The embed address for this exact title or episode, https (7.3). */
  url: string;
  /** The origin allowed to post messages. */
  origin: string;
  order: number;
  /** The resume parameter, seconds, when documented. */
  startParam?: string;
  /** The subtitle-language parameter, when documented. */
  subtitlesParam?: string;
  /** The nested-frame origins the player really uses (`14` section 2.4). */
  frameOrigins?: string[];
  /** Absent: no documented messages. */
  messageShape?: "vidsrc-status" | "player-event";
}

/** `GET /api/titles/:titleId` (docs/03 section 3.6); nothing here is stored. */
export interface TitleDetail {
  id: string;
  kind: "movie" | "tv";
  title: string;
  year?: number;
  plot?: string;
  /** 0 to 10. */
  rating?: number;
  genres: string[];
  /** At most ten names. */
  cast: string[];
  /** A movie. */
  runtimeMs?: number;
  /** A series. */
  seasons?: Array<{ season: number; episodeCount: number }>;
  /** Image-cache addresses (3.11). */
  posterUrl?: string;
  backdropUrl?: string;
  /** A movie's stream address as the backend's rule filled it (7.5); absent when no rule is set. */
  streamUrl?: string;
  /** The playable provider sources, in preference order (7.5); provider records stop at the fileserver. */
  sources?: TitleSource[];
}

/** One episode of a season (docs/03 section 3.6). */
export interface Episode {
  season: number;
  episode: number;
  title?: string;
  airDate?: string;
  runtimeMs?: number;
  /** An image-cache address (3.11). */
  stillUrl?: string;
  /** This exact episode's stream address as the backend's rule filled it (7.5). */
  streamUrl?: string;
  /** This exact episode's playable sources (7.5). */
  sources?: TitleSource[];
}

/** `GET /api/titles/:titleId` (docs/03 section 3.6): the detail as the backend filled it. */
export type TitleAnswer = TitleDetail;

export interface SeasonAnswer {
  episodes: Episode[];
}

export type RelatedBasis = "tmdb" | "genre-year" | "genre" | "year";

/** `GET /api/titles/:titleId/related` (docs/03 section 3.6, `06` section 5.5). */
export interface RelatedAnswer {
  basis: RelatedBasis;
  items: LibraryItem[];
}

/** One row of the library query (docs/03 section 3.5). No field here is a local path. */
export interface LibraryItem {
  ref: ItemRef;
  /** History rows only: the watch entry this row is. */
  watchId?: string;
  kind: "movie" | "tv" | "local";
  /** A local file's display name. */
  title: string;
  year?: number;
  /** An image-cache address; a local file's still. */
  posterUrl?: string;
  /** A local file only: from its height, for example `1080p`; TMDB titles have none. */
  quality?: string;
  genres: string[];
  favorite: boolean;
  progress?: {
    positionMs: number;
    durationMs?: number;
    state: "watching" | "watched";
    season?: number;
    episode?: number;
  };
}

/** `GET /api/library` (docs/03 section 3.5). */
export interface LibraryPage {
  items: LibraryItem[];
  /** When known: TMDB reports its own totals. */
  total?: number;
  nextCursor?: string;
  /** The choices for the Genre and Year filters. */
  facets: { genres: string[]; years: number[] };
  /** Whether the trending sort can be offered (`11` section 4). */
  trending: boolean;
  /** False while the backend cannot be reached: title regions are skeletons. */
  titlesAvailable: boolean;
}

/** `GET /api/library/continue` (docs/03 section 3.5, `06` section 4.2): the items only. */
export interface ContinuePage {
  items: LibraryItem[];
}
