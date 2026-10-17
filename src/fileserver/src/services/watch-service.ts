import { AppError } from "../lib/app-error.js";
import type { ItemRef } from "../types/collection.js";
import type { WatchEntry, WatchWrite } from "../types/watch.js";
import type { ItemKind } from "../store/collection-repository.js";
import type { FavoritesRepository } from "../store/favorites-repository.js";
import type { WatchRepository } from "../store/watch-repository.js";

const kinds: readonly ItemKind[] = ["title", "local"];

/** How many playbacks' last seq the service remembers; far more than a person has open at once. */
const PLAYBACKS_REMEMBERED = 512;

const notFound = (): AppError => new AppError("watch.not_found", 404, "There is no such watch entry.");

const isKind = (value: string): value is ItemRef["kind"] => kinds.includes(value as ItemRef["kind"]);

export interface FavoritesService {
  /** Idempotent both ways; answers `{ ref, favorite }` (3.12). */
  set: (kind: string, itemId: string, favorite: boolean) => { ref: ItemRef; favorite: boolean };
}

export function createFavoritesService(favorites: FavoritesRepository, now: () => number): FavoritesService {
  return {
    set(kind, itemId, favorite) {
      const refKind = isKind(kind)
        ? kind
        : (() => {
            throw new AppError("collection.invalid", 422, "That kind is not an item kind.");
          })();
      const ref: ItemRef = { kind: refKind, id: itemId };
      if (favorite) favorites.add(refKind, itemId, now());
      else favorites.remove(refKind, itemId);
      return { ref, favorite: favorites.isFavorite(refKind, itemId) };
    },
  };
}

export interface WatchService {
  /**
   * `PUT /api/watch` (3.13): the identity is the item with its exact episode; a write whose `seq`
   * is not higher than the last applied for its playback is refused. `watched` is sticky.
   */
  write: (input: WatchWrite) => { applied: boolean; entry: WatchEntry | null };
  /** `DELETE /api/watch/:watchId`; an unknown id is `404 watch.not_found`. */
  drop: (watchId: string) => { removed: string };
  /** `DELETE /api/watch`; favorites, collections and files are untouched (3.13). */
  clear: () => { cleared: number };
}

export function createWatchService(deps: {
  watches: WatchRepository;
  /** The `watchedPercent` setting, read at each write (03 section 3.2; the table's default is 90). */
  watchedPercent: () => 90 | 95 | 100;
  /** The `pauseHistory` setting: while true no write changes anything (03 section 3.2). */
  paused: () => boolean;
  now: () => number;
}): WatchService {
  const { watches, watchedPercent, paused, now } = deps;
  /** The last applied seq of each playback, in memory only (03 section 3.13's ordering rule). */
  const lastSeqByPlayback = new Map<string, number>();

  const entryOf = (row: ReturnType<WatchRepository["upsert"]>): WatchEntry => ({
    watchId: row.id,
    item: { kind: row.itemKind, id: row.itemId },
    ...(row.season !== undefined && { season: row.season }),
    ...(row.episode !== undefined && { episode: row.episode }),
    positionMs: row.positionMs,
    ...(row.durationMs !== undefined && { durationMs: row.durationMs }),
    state: row.state,
    updatedAt: row.updatedAt,
  });

  return {
    write(input) {
      const playback = input.playbackId;
      const done = lastSeqByPlayback.get(playback) ?? 0;
      const existing = watches.findByIdentity({
        kind: input.item.kind,
        itemId: input.item.id,
        season: input.season,
        episode: input.episode,
      });
      // Paused history and a late write both answer the entry as it stands and change nothing.
      if (paused() || input.seq <= done) {
        return { applied: false, entry: existing === null ? null : entryOf(existing) };
      }
      // Re-inserting moves the playback to the newest end, so the oldest one is the one dropped.
      lastSeqByPlayback.delete(playback);
      lastSeqByPlayback.set(playback, input.seq);
      if (lastSeqByPlayback.size > PLAYBACKS_REMEMBERED) {
        const oldest = lastSeqByPlayback.keys().next();
        if (!oldest.done) lastSeqByPlayback.delete(oldest.value);
      }
      // A position past a known end is the end (a player's last tick can overshoot by a frame).
      const position =
        input.durationMs === undefined ? input.positionMs : Math.min(input.positionMs, input.durationMs);
      const over = input.durationMs !== undefined && position >= (input.durationMs * watchedPercent()) / 100;
      const state = existing?.state === "watched" || over ? "watched" : "watching";
      const row = watches.upsert({
        id: existing?.id ?? randomId(),
        kind: input.item.kind,
        itemId: input.item.id,
        season: input.season,
        episode: input.episode,
        positionMs: position,
        durationMs: input.durationMs,
        state,
        at: now(),
      });
      return { applied: true, entry: entryOf(row) };
    },

    drop(watchId) {
      if (!watches.remove(watchId)) throw notFound();
      return { removed: watchId };
    },

    clear: () => ({ cleared: watches.clearAll() }),
  };
}

function randomId(): string {
  return crypto.randomUUID();
}
