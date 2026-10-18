import { PAGE_SIZE } from "@giga/ui/lib/window-constants";
import type { AdminChannel } from "@/types/admin-channel";
import type { Pages } from "./channel-pages";

/* The Preview's walk (`36` section 8.1), pure: Previous and Next move through the channels the Channels list shows, in its
 * order, from the channel being previewed. The place is an index into the list's query result; a row is found among the
 * loaded pages by that index, and a page that is not loaded is read through the list's own page read, never a new route. */

export const FIRST_REASON = "This is the first channel.";
export const LAST_REASON = "This is the last channel.";
export const ONLY_REASON = "Only one channel.";
export const NOT_LISTED_REASON = "This channel is not in the list.";

/** What the walk reads from the channels slice. */
export interface WalkHolds {
  readonly pages: Pages<AdminChannel>;
  readonly items: readonly AdminChannel[];
  readonly total: number | null;
  readonly preview: { readonly channelId: string; readonly at: number | null } | null;
}

/** The index of a row among the loaded pages (pages may be sparse, so it counts by page, not by rows held); null if absent. */
export function positionOf(pages: Pages<AdminChannel>, id: string): number | null {
  for (const [key, rows] of Object.entries(pages)) {
    const at = rows.findIndex((row) => row.id === id);
    if (at !== -1) return Number(key) * PAGE_SIZE + at;
  }
  return null;
}

/** Where the previewed channel stands: the list's own copy first, else the place it was last known to hold. */
export function placeOf(holds: WalkHolds): number | null {
  if (holds.preview === null) return null;
  return positionOf(holds.pages, holds.preview.channelId) ?? holds.preview.at;
}

/** How many channels the list holds in all: the query's total, or the loaded rows while it is not known. */
export const walkTotal = (holds: WalkHolds): number => holds.total ?? holds.items.length;

export interface WalkReasons {
  readonly previous: string | undefined;
  readonly next: string | undefined;
}

/** Why Previous and Next cannot be pressed, each undefined when it can. */
export function walkReasons(holds: WalkHolds): WalkReasons {
  const at = placeOf(holds);
  const total = walkTotal(holds);
  if (at === null) return { previous: NOT_LISTED_REASON, next: NOT_LISTED_REASON };
  if (total <= 1) return { previous: ONLY_REASON, next: ONLY_REASON };
  return {
    previous: at <= 0 ? FIRST_REASON : undefined,
    next: at >= total - 1 ? LAST_REASON : undefined,
  };
}

export type WalkStep =
  | { readonly kind: "to"; readonly row: AdminChannel; readonly at: number }
  | { readonly kind: "read"; readonly page: number; readonly at: number }
  | { readonly kind: "none" };

/** The neighbour in a direction: its row when the page holds it, else the page to read first, else nothing (an end). */
export function walkStep(holds: WalkHolds, direction: -1 | 1): WalkStep {
  const reasons = walkReasons(holds);
  const at = placeOf(holds);
  if (at === null || (direction < 0 ? reasons.previous : reasons.next) !== undefined) return { kind: "none" };
  const target = at + direction;
  const row = holds.pages[Math.floor(target / PAGE_SIZE)]?.[target % PAGE_SIZE];
  return row === undefined ? { kind: "read", page: Math.floor(target / PAGE_SIZE), at: target } : { kind: "to", row, at: target };
}
