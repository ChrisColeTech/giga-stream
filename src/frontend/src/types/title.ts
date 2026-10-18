/** A title's detail, passed through from the backend (`03` section 3.6). Nothing is stored. */
export interface TitleDetail {
  /** The kind and TMDB id, for example `movie-603` or `tv-1399`. */
  readonly id: string;
  readonly kind: "movie" | "tv";
  readonly title: string;
  readonly year?: number;
  readonly plot?: string;
  /** 0 to 10. */
  readonly rating?: number;
  readonly genres: readonly string[];
  /** At most ten names. */
  readonly cast: readonly string[];
  /** A movie's runtime. */
  readonly runtimeMs?: number;
  /** A series' seasons. */
  readonly seasons?: readonly { readonly season: number; readonly episodeCount: number }[];
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  /** Absent when no stream rule is set. */
  readonly streamUrl?: string;
  readonly sources?: readonly import("@/services/schemas/source-schema").TitleSource[];
  /** Set when the fileserver answered from its cache because the backend was not reachable: nothing can play
   *  (`46` section A). */
  readonly fromCache?: true;
}

export interface Episode {
  readonly season: number;
  readonly episode: number;
  readonly title?: string;
  readonly airDate?: string;
  readonly runtimeMs?: number;
  readonly stillUrl?: string;
  /** Absent when no stream rule is set. */
  readonly streamUrl?: string;
  readonly sources?: readonly import("@/services/schemas/source-schema").TitleSource[];
}
