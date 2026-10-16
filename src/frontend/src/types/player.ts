import type { ItemRef } from "./library";

/** What a Player tab holds (`06` section 5.1): one per movie, one per series, one per local file. */
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
