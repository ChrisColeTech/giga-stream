import { createAccountsSlice, type AccountsSlice } from "./accounts";
import { createChannelsSlice, type ChannelsSlice } from "./channels";
import { createJobProgressSlice, type JobProgressSlice } from "./job-progress";
import { createJobsSlice, type JobsSlice } from "./jobs";
import { createPlaylistsSlice, type PlaylistsSlice } from "./playlists";
import { createProvidersSlice, type ProvidersSlice } from "./providers";
import type { SliceGet, SliceSet } from "./slice-host";
import { createTitlesSlice, type TitlesSlice } from "./titles";

/** THE REGISTRY (`39` section 5): the only place `store/app-store.ts` reads tab state from. A tab's wave replaces only
 *  its own `slices/<tab>.ts`; this file and the store never change again, so parallel waves never edit the same line. */
export type TabSlices = ChannelsSlice & ProvidersSlice & TitlesSlice & PlaylistsSlice & JobsSlice & AccountsSlice & JobProgressSlice;

export function tabSlices(set: SliceSet<TabSlices>, get: SliceGet<TabSlices>): TabSlices {
  return {
    ...createChannelsSlice(set, get),
    ...createProvidersSlice(set, get),
    ...createTitlesSlice(set, get),
    ...createPlaylistsSlice(set, get),
    ...createJobsSlice(set, get),
    ...createAccountsSlice(set, get),
    ...createJobProgressSlice(set, get),
  };
}
