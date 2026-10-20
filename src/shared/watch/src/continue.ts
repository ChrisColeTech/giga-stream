/**
 * Continue Watching (docs/03 section 3.5, docs/06 section 4.2): the newest `watching` entry of
 * each item, at most ten, most recently watched first. A `watched` entry never continues — an
 * item finished to its threshold leaves the strip even when an older episode of it was left
 * mid-way, because the item's newest entry is the one that counts.
 */
import type { WatchEntry } from "./entry";
import { newestPerItem } from "./order";

/**
 * The Continue answer, taken from the whole history: each item's newest entry is the one that
 * counts, only entries still being watched stay, and the strip is capped at `max` rows. `max` is
 * the caller's named limit (the fileserver answers with its CONTINUE_MAX, 10); a cap below one
 * answers an empty strip.
 */
export function continueEntries(entries: readonly WatchEntry[], max: number): WatchEntry[] {
  return newestPerItem(entries)
    .filter((entry) => entry.state === "watching")
    .slice(0, Math.max(0, max));
}
