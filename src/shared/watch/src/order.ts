/**
 * The newest-first rule (docs/30 section 1): history is answered most recently watched first, and
 * every selection that looks at the whole list keeps that order. The sort is stable, so entries
 * written at the same millisecond keep the store's own order — the store breaks ties by insertion
 * (rowid), and this never reshuffles what the store ordered.
 */
import { itemIdentity } from "./entry";
import type { WatchEntry } from "./entry";

/** The entries, most recently updated first; the input list is left alone. */
export function newestFirst<T extends { updatedAt: number }>(entries: readonly T[]): T[] {
  return [...entries].sort((one, other) => other.updatedAt - one.updatedAt);
}

/**
 * Each item's newest entry, newest first: an item with several watched episodes counts once, by
 * the entry it was last touched with (docs/30 section 3.3 — one resume point per title, the
 * newest). Everything built "per item" — the watched sets and Continue — selects from this.
 */
export function newestPerItem<T extends WatchEntry>(entries: readonly T[]): T[] {
  const seen = new Set<string>();
  return newestFirst(entries).filter((entry) => {
    const key = itemIdentity(entry);
    return !seen.has(key) && seen.add(key);
  });
}
