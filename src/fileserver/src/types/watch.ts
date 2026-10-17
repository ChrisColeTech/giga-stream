/** The watch-history DTOs (docs/03 section 3.13). Story: what the user tuned last. */
import type { ItemRef } from "./collection.js";

/** The `PUT /api/watch` body (validated at the service; `playbackId` nonempty, `seq >= 0`). */
export interface WatchWrite {
  item: ItemRef;
  /** A series episode only. */
  season?: number;
  episode?: number;
  positionMs: number;
  durationMs?: number;
  /** Minted by the interface for each playback; a late write of an old seq never applies. */
  playbackId: string;
  /** 1, 2, 3 ... within that playback. */
  seq: number;
}

/**
 * The entry answer (3.13): the identity is the item with its exact episode, never the playback.
 * `state` is `watching` or `watched`; it flips to `watched` at the `watchedPercent` setting's
 * share of the duration (3.2).
 */
export interface WatchEntry {
  watchId: string;
  item: ItemRef;
  season?: number;
  episode?: number;
  positionMs: number;
  durationMs?: number;
  state: "watching" | "watched";
  updatedAt: number;
}
