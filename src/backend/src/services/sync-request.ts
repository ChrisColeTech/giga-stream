import type { Kind } from "./title-shapes.js";

/** What a catalog job runs (docs/49): a trending or popular list, the Library fill, or the Library update. */
export type SyncScope = "trending" | "popular" | "discover" | "recent";

/** One sync run's request. The Library fill and the Library update take no kind and no page count. */
export interface SyncRequest {
  scope: SyncScope;
  kind?: Kind | "all";
  pages?: number;
  /** The Library update's cursor: where its `airing` window starts, as a time (docs/49 section 2.4). */
  since?: number;
}
