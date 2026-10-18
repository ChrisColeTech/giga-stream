import type { Tab } from "@/types/shell";
import type { SliceGet, SliceSet } from "./slice-host";

/** Which tabs hold data another tab's write has made old (`39` section 5). A flow that changes another tab's records
 *  calls `markStale(thatTab)`; that tab's load hook re-reads when it is next shown and clears the mark. No flow ever
 *  writes another tab's slice. Reset on sign-out. */
export interface StaleSlice {
  stale: Readonly<Record<Tab, boolean>>;
  markStale: (tab: Tab) => void;
  clearStale: (tab: Tab) => void;
}

export const NO_STALE: Readonly<Record<Tab, boolean>> = {
  channels: false,
  providers: false,
  titles: false,
  playlists: false,
  jobs: false,
  accounts: false,
};

export function createStaleSlice(set: SliceSet<StaleSlice>, get: SliceGet<StaleSlice>): StaleSlice {
  return {
    stale: NO_STALE,
    markStale: (tab) => set({ stale: { ...get().stale, [tab]: true } }),
    clearStale: (tab) => set({ stale: { ...get().stale, [tab]: false } }),
  };
}
