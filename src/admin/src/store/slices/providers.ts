import type { SliceGet, SliceSet } from "./slice-host";

/** PLACEHOLDER. The Providers wave replaces this file (it re-exports `store/providers-slice.ts`); until then the tab has
 *  no state of its own and the registry spreads nothing for it. */
export type ProvidersSlice = Record<never, never>;

export function createProvidersSlice(_set: SliceSet<ProvidersSlice>, _get: SliceGet<ProvidersSlice>): ProvidersSlice {
  return {};
}
