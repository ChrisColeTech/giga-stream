/**
 * The watch entry and its identity (docs/03 section 3.13, docs/30 sections 1 and 3). Story: what
 * the user watched, to the exact episode. These shapes are the one definition both programs share:
 * the fileserver's `watch_entries` rows and its DTOs and, in a later wave, the interface's local
 * store all hold exactly these fields. No I/O lives here and no program's private type is imported.
 */

/** An entry is being watched, or it is finished; `watched` never goes back (3.13). */
export type WatchState = "watching" | "watched";

/** What was played: a backend title or a local file, named by kind and id. */
export interface WatchItemRef {
  kind: "title" | "local";
  id: string;
}

/**
 * One entry of watch history. The identity is the item with its exact episode — a series episode
 * and the same series without an episode are different entries (the store's unique COALESCE index,
 * migration 001) — and it carries no playback key, so a rewatch of the same episode is the same
 * entry moved forward, never a second row.
 */
export interface WatchEntry {
  watchId: string;
  item: WatchItemRef;
  /** A series episode only; the write carries both parts or neither. */
  season?: number;
  episode?: number;
  positionMs: number;
  durationMs?: number;
  state: WatchState;
  updatedAt: number;
}

/**
 * The entry's identity as the store keys it (the COALESCE index, 001): an absent season or episode
 * takes the sentinel -1, its own value, so the series-without-episode entry never collides with
 * any episode entry of the same item. Entries with equal identities are the same entry.
 */
export function entryIdentity(entry: Pick<WatchEntry, "item" | "season" | "episode">): string {
  return `${entry.item.kind}:${entry.item.id}:${entry.season ?? -1}:${entry.episode ?? -1}`;
}

/** The item's identity without the episode: the key "newest entry per item" is counted by. */
export function itemIdentity(entry: Pick<WatchEntry, "item">): string {
  return `${entry.item.kind}:${entry.item.id}`;
}
