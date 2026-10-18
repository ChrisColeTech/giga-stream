import type { AdminChannel, ChannelState } from "@/types/admin-channel";

/* The held channel list and its ticks (`36` section 4): pure list operations the slice and the flows share. The list is
 * kept as the backend answered it; the grid orders it (`channelRows`). Ids are opaque strings. */

/** The engine states the statusbar counts as `N preparing` and the Status group draws as a skeleton. */
export const BUILDING_STATES: ReadonlySet<ChannelState> = new Set(["preparing", "starting", "restarting"]);

export const findChannel = (items: readonly AdminChannel[], id: string): AdminChannel | undefined =>
  items.find((item) => item.id === id);

/** Replaces the channel with the same id, or adds it at the end. */
export function upsertChannel(items: readonly AdminChannel[], channel: AdminChannel): AdminChannel[] {
  const at = items.findIndex((item) => item.id === channel.id);
  if (at === -1) return [...items, channel];
  return items.map((item, index) => (index === at ? channel : item));
}

export const withoutChannel = (items: readonly AdminChannel[], id: string): AdminChannel[] =>
  items.filter((item) => item.id !== id);

/** The ticks of rows still in the list, in their order. */
export const pruneTicks = (ticked: readonly string[], items: readonly AdminChannel[]): string[] =>
  ticked.filter((id) => items.some((item) => item.id === id));

export const isTicked = (ticked: readonly string[], id: string): boolean => ticked.includes(id);

/** The header's select-all tick: on over a fully ticked list, `mixed` over a part, off otherwise. */
export function selectAllState(items: readonly AdminChannel[], ticked: readonly string[]): boolean | "mixed" {
  const count = items.filter((item) => ticked.includes(item.id)).length;
  if (count === 0) return false;
  return count === items.length ? true : "mixed";
}

/** Enabled live channels being built: what the statusbar's `N preparing` reads. A disabled row is never counted. */
export const preparingCount = (items: readonly AdminChannel[]): number =>
  items.filter((item) => item.kind === "live" && item.enabled && BUILDING_STATES.has(item.state)).length;

/** Is this live channel being built (its Status facts are shimmer until a read says otherwise)? */
export const isBuilding = (channel: AdminChannel): boolean => channel.kind === "live" && BUILDING_STATES.has(channel.state);

/** The ticked channels, in list order. */
export const tickedChannels = (items: readonly AdminChannel[], ticked: readonly string[]): AdminChannel[] =>
  items.filter((item) => ticked.includes(item.id));
