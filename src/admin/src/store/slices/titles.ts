import type { SliceGet, SliceSet } from "./slice-host";

/** PLACEHOLDER. The Titles wave replaces this file (it re-exports `store/titles-slice.ts`); until then the tab has no
 *  state of its own and the registry spreads nothing for it. */
export type TitlesSlice = Record<never, never>;

export function createTitlesSlice(_set: SliceSet<TitlesSlice>, _get: SliceGet<TitlesSlice>): TitlesSlice {
  return {};
}
