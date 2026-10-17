import type { ItemRef } from "./library";
import type { LocalMediaInfo } from "@/services/local-media";
import type { PlayerSource } from "@/lib/player-sources";

/** The one item Player holds. Opening another replaces it (`06` section 5.1). */
export interface PlayerTab {
  readonly id: string;
  readonly ref: ItemRef;
  readonly kind: "movie" | "tv" | "local";
  readonly title: string;
  /** For a series, the exact episode: `S01 E02`. */
  readonly subtitle?: string;
}

/** The stage's state, a discriminated union (`01` section 5). */
export type StageState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "failed"; readonly reason: string };

export interface PlayerMediaState {
  readonly sources: readonly PlayerSource[];
  readonly activeSourceId: string | null;
  readonly stage: StageState;
}

export interface PlayerLocalState {
  readonly info?: LocalMediaInfo;
}
