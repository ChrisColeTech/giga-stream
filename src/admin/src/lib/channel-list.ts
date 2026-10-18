import type { AdminChannel, ChannelState } from "@/types/admin-channel";

/* The held channels (`36` section 4, `41` section 4.3), pure list operations the slice and the flows share. The list is
 * paged, so a channel is found in the loaded pages, among the ticked rows (kept whole so a tick outlives its page), the
 * one a workspace opened, or the live rows. Ids are opaque strings. */

/** The engine states the statusbar counts as `N preparing` and the Status group draws as a skeleton. */
export const BUILDING_STATES: ReadonlySet<ChannelState> = new Set(["preparing", "starting", "restarting"]);

/** Where a channel may be found besides the loaded pages. */
export interface ChannelHolds {
  readonly items: readonly AdminChannel[];
  readonly held: Readonly<Record<string, AdminChannel>>;
  readonly opened: AdminChannel | null;
  readonly live: readonly AdminChannel[];
}

export const findChannel = (items: readonly AdminChannel[], id: string): AdminChannel | undefined =>
  items.find((item) => item.id === id);

/** The channel with this id wherever the tab holds it: the loaded pages, the ticked rows, the opened workspace, the live
 *  rows. A workspace and a bulk run never depend on a page staying loaded. */
export function channelById(holds: ChannelHolds, id: string): AdminChannel | undefined {
  return (
    findChannel(holds.items, id) ??
    holds.held[id] ??
    (holds.opened?.id === id ? holds.opened : undefined) ??
    findChannel(holds.live, id)
  );
}

/** Enabled live channels being built: what the statusbar's `N preparing` reads. A disabled row is never counted. */
export const preparingCount = (items: readonly AdminChannel[]): number =>
  items.filter((item) => item.kind === "live" && item.enabled && BUILDING_STATES.has(item.state)).length;

/** Is this live channel being built (its Status facts are shimmer until a read says otherwise)? */
export const isBuilding = (channel: AdminChannel): boolean => channel.kind === "live" && BUILDING_STATES.has(channel.state);

/** The ticked channels among these rows, in the rows' order. */
export function tickedChannels(items: readonly AdminChannel[], ticked: readonly string[]): AdminChannel[] {
  const wanted = new Set(ticked);
  return items.filter((item) => wanted.has(item.id));
}

/** Every ticked channel the tab holds whole, in tick order; the ids it holds no row for are not in the list. */
export function heldTicked(held: Readonly<Record<string, AdminChannel>>, ticked: readonly string[]): AdminChannel[] {
  return ticked.flatMap((id) => {
    const row = held[id];
    return row === undefined ? [] : [row];
  });
}
