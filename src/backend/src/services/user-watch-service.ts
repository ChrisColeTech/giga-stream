import { randomUUID } from "node:crypto";

// The watchedPercent rule is the shared library's (docs/61 section 2.5); both servers run this one
// implementation, so a write can never land `watched` on one and `watching` on the other (docs/63 3.2).
import type { WatchEntry } from "../../../shared/watch/dist/entry.js";
import { clampPosition, entryState } from "../../../shared/watch/dist/threshold.js";

import { AppError, ERRORS } from "../constants/errors.js";
import type { StoredWatch } from "../store/user-watch-repository.js";
import type { Store } from "../store/store.js";
import type { Principal } from "../types/account.js";
import type { UserSettings } from "../types/user-settings.js";
import type { WatchWrite } from "../types/user-watch.js";

/** How many playbacks' last seq the service remembers; far more than a person has open at once. */
const PLAYBACKS_REMEMBERED = 512;

/**
 * The threshold a write uses when the account's settings carry no `watchedPercent`: the settings table's
 * default (docs/03 section 3.2), the same one the fileserver's write reads.
 */
const DEFAULT_WATCHED_PERCENT = 90;

const notFound = (): AppError => new AppError(ERRORS.watchNotFound);

/** A store row as the entry the routes answer (03 section 3.13): the shared library's one shape. */
const entryOf = (row: StoredWatch): WatchEntry => ({
  watchId: row.id,
  item: { kind: row.itemKind, id: row.itemId },
  ...(row.season !== undefined && { season: row.season }),
  ...(row.episode !== undefined && { episode: row.episode }),
  positionMs: row.positionMs,
  ...(row.durationMs !== undefined && { durationMs: row.durationMs }),
  state: row.state,
  updatedAt: row.updatedAt,
});

/**
 * The signed-in account's watch history (docs/63 section 3.2): the fileserver's watch service semantics,
 * every query scoped to the principal's account, so the fileserver's browser pass-through can return the
 * account's answer without translating it. A preference, not an administrative change: no audit entry.
 */
export function createUserWatchService(deps: {
  store: Store;
  /** The account's settings document as it stands, read at each write (`watchedPercent`, `pauseHistory`). */
  settings: { read: (principal: Principal) => Promise<{ settings: UserSettings }> };
  now: () => number;
}) {
  const { store, settings, now } = deps;
  /** The last applied seq of each playback, in memory only (03 section 3.13's ordering rule). The key is the
   * account's as well as the playback's: the ids are minted client-side, so without it one account's
   * playback could consume another's seq budget and swallow its writes as "late". */
  const lastSeqByPlayback = new Map<string, number>();

  /** The rule a write is judged by: the account's own settings at this write, defaults as the table has them. */
  async function ruleOf(principal: Principal): Promise<{ watchedPercent: number; paused: boolean }> {
    const { settings: document } = await settings.read(principal);
    return {
      watchedPercent: document.watchedPercent ?? DEFAULT_WATCHED_PERCENT,
      paused: document.pauseHistory === true,
    };
  }

  return {
    /**
     * `PUT /watch` (03 section 3.13): the identity is the item with its exact episode; a write whose `seq`
     * is not higher than the last applied for its playback is refused. `watched` is sticky.
     */
    write: async (principal: Principal, input: WatchWrite): Promise<{ applied: boolean; entry: WatchEntry | null }> => {
      const seqKey = `${principal.accountId}:${input.playbackId}`;
      const done = lastSeqByPlayback.get(seqKey) ?? 0;
      const identity = { kind: input.item.kind, itemId: input.item.id, season: input.season, episode: input.episode };
      const existing = await store.userWatch.findByIdentity(principal.accountId, identity);
      const rule = await ruleOf(principal);
      // Paused history and a late write both answer the entry as it stands and change nothing.
      if (rule.paused || input.seq <= done) {
        return { applied: false, entry: existing === null ? null : entryOf(existing) };
      }
      // Re-inserting moves the playback to the newest end, so the oldest one is the one dropped.
      lastSeqByPlayback.delete(seqKey);
      lastSeqByPlayback.set(seqKey, input.seq);
      if (lastSeqByPlayback.size > PLAYBACKS_REMEMBERED) {
        const oldest = lastSeqByPlayback.keys().next();
        if (!oldest.done) lastSeqByPlayback.delete(oldest.value);
      }
      // The position and the state are the shared semantics (docs/61 section 2.5): the clamp, the
      // sticky `watched` and the threshold read at this write.
      const position = clampPosition(input.positionMs, input.durationMs);
      const state = entryState(existing?.state, position, input.durationMs, rule.watchedPercent);
      const row = await store.userWatch.upsert(principal.accountId, {
        id: existing?.id ?? randomUUID(),
        kind: input.item.kind,
        itemId: input.item.id,
        season: input.season,
        episode: input.episode,
        positionMs: position,
        durationMs: input.durationMs,
        state,
        at: now(),
        playbackId: input.playbackId,
        seq: input.seq,
      });
      return { applied: true, entry: entryOf(row) };
    },

    /** `DELETE /watch/:watchId`; an unknown id - another account's as much as any - is `404 watch.not_found`. */
    drop: async (principal: Principal, watchId: string): Promise<{ removed: string }> => {
      if (!(await store.userWatch.remove(principal.accountId, watchId))) throw notFound();
      return { removed: watchId };
    },

    /** `DELETE /watch`; the account's whole history, and nothing else of the account's. */
    clear: async (principal: Principal): Promise<{ cleared: number }> => ({
      cleared: await store.userWatch.clearAll(principal.accountId),
    }),

    /** `GET /watch`: the account's entries, most recently updated first. */
    list: async (principal: Principal): Promise<{ entries: WatchEntry[] }> => ({
      entries: (await store.userWatch.list(principal.accountId)).map(entryOf),
    }),
  };
}

export type UserWatchService = ReturnType<typeof createUserWatchService>;
