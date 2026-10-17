/** A reference to something the user's data holds (`03` section 2). */
export type ItemRef = { readonly kind: "title"; readonly id: string } | { readonly kind: "local"; readonly id: string };

export type LibraryKind = "movie" | "tv" | "local";
export type MembershipSource = "manual" | "folder";
export interface Membership {
  readonly collectionId: string;
  readonly source: MembershipSource;
}

export interface Progress {
  readonly positionMs: number;
  readonly durationMs?: number;
  readonly state: "watching" | "watched";
  readonly season?: number;
  readonly episode?: number;
}

/** One row of Library's body (`03` section 3.5). */
export interface LibraryItem {
  readonly ref: ItemRef;
  /** History rows only: the watch entry this row is. */
  readonly watchId?: string;
  readonly kind: LibraryKind;
  readonly title: string;
  readonly year?: number;
  readonly posterUrl?: string;
  /** A real value only, never an invented HD. */
  readonly quality?: string;
  readonly genres: readonly string[];
  /** TMDB's rating, 0 to 10, unrounded; absent when unknown (a local file never has one). */
  readonly rating?: number;
  readonly favorite: boolean;
  /** Present only in a collection view; manual wins while both sources include the item. */
  readonly collectionSource?: MembershipSource;
  readonly progress?: Progress;
}

export interface LibraryPage {
  readonly items: readonly LibraryItem[];
  readonly total?: number;
  readonly nextCursor?: string;
  readonly facets: { readonly genres: readonly string[]; readonly years: readonly number[] };
  /** Whether the Trending sort can be offered (`11` section 4). */
  readonly trending: boolean;
  /** False while the backend cannot be reached: title regions are skeletons. */
  readonly titlesAvailable: boolean;
}
