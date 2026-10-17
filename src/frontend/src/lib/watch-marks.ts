import type { ItemRef, LibraryItem, Progress } from "@/types/library";

/** What the interface learned from its own watch writes and removals, by item key (docs/30 section 3.3). It is newer
 *  than any snapshot of an item taken when it was opened, so the Player prefers it. `progress` absent is a tombstone:
 *  the entry was removed, and the item's older snapshot must not be resumed. */
export interface WatchMark {
  readonly watchId?: string;
  readonly progress?: Progress;
}

/** The slice of a write's answer a mark is made from (`WatchEntrySchema`). */
export interface MarkedEntry {
  readonly watchId: string;
  readonly item: ItemRef;
  readonly season?: number;
  readonly episode?: number;
  readonly positionMs: number;
  readonly durationMs?: number;
  readonly state: "watching" | "watched";
}

export function markOf(entry: MarkedEntry): WatchMark {
  return {
    watchId: entry.watchId,
    progress: {
      positionMs: entry.positionMs,
      ...(entry.durationMs === undefined ? {} : { durationMs: entry.durationMs }),
      state: entry.state,
      ...(entry.season === undefined ? {} : { season: entry.season }),
      ...(entry.episode === undefined ? {} : { episode: entry.episode }),
    },
  };
}

export const REMOVED_MARK: WatchMark = {};

/** The item with the mark's progress and watch id in place of its snapshot's. No mark leaves it as it was. */
export function withWatchMark(item: LibraryItem | undefined, mark: WatchMark | undefined): LibraryItem | undefined {
  if (item === undefined || mark === undefined) return item;
  return { ...item, watchId: mark.watchId, progress: mark.progress };
}
