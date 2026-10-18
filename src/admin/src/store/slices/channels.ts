import type { SliceGet, SliceSet } from "./slice-host";

/** PLACEHOLDER. The Channels wave replaces this file (it re-exports `store/channels-slice.ts`); until then the tab has
 *  no state of its own and the registry spreads nothing for it. */
export type ChannelsSlice = Record<never, never>;

export function createChannelsSlice(_set: SliceSet<ChannelsSlice>, _get: SliceGet<ChannelsSlice>): ChannelsSlice {
  return {};
}
