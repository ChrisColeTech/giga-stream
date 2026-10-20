import { continueEntries } from "@giga/watch/continue";
import { entryIdentity, type WatchEntry } from "@giga/watch/entry";
import { newestFirst } from "@giga/watch/order";
import { pageOf, type HistoryPage } from "@giga/watch/page";
import { clampPosition, entryState } from "@giga/watch/threshold";
import { useAppStore } from "@/store/app-store";
import {
  idbCore,
  memoryCore,
  openIdb,
  sentenceOfError,
  speak,
  type EntryCore,
  type IdbFactoryLike,
} from "./local-watch-idb";
import type { ClearedWatch, RemovedWatch, WatchWrite, WatchWriteAnswer } from "./schemas/watch-schema";

/** The browser runtime's local watch history (`61` section 2.5): entries live in IndexedDB - a per-episode log
 *  outgrows `localStorage` - keyed by the shared entry identity, and every selection is a call into
 *  `src/shared/watch`, never a reimplementation. This file holds the program's one `indexedDB` word. A failed open
 *  or write degrades to memory for the session with one spoken warning (`61` section 6). */

/** How many playbacks' last seq the store remembers; the fileserver's service keeps the same number. */
export const WATCH_PLAYBACKS_REMEMBERED = 512;

export interface LocalWatchDeps {
  readonly factory?: IdbFactoryLike;
  readonly now?: () => number;
  /** The `watchedPercent` rule is applied at write time; the store reads it at each write (`shared/watch/threshold`). */
  readonly watchedPercent?: () => number;
}

/** The store the transport and the Library's local reads share: the resolver's write and removals, plus the list
 *  selections the Library joins its rows from. All reads and writes are async, which the writeback shape tolerates. */
export interface LocalWatch {
  readonly write: (write: WatchWrite) => Promise<WatchWriteAnswer>;
  readonly remove: (watchId: string) => Promise<RemovedWatch>;
  readonly clear: () => Promise<ClearedWatch>;
  readonly entries: () => Promise<WatchEntry[]>;
  readonly continueSelection: (max: number) => Promise<WatchEntry[]>;
  readonly historyPage: (page: number, pageSize: number) => Promise<HistoryPage<WatchEntry>>;
}

/** The store over a core: the playback-seq ordering rule (`docs/30` section 3.13), the shared write semantics and
 *  the session degrade - a storage failure flips the store to memory once and repeats the operation there; once
 *  degraded, a failure is the caller's error, never another silent fallback. */
function createLocalWatch(start: EntryCore, deps: LocalWatchDeps): LocalWatch {
  const now = deps.now ?? ((): number => Date.now());
  const watchedPercent = deps.watchedPercent ?? ((): number => useAppStore.getState().playback.watchedPercent);
  const lastSeqByPlayback = new Map<string, number>();
  let degraded = false;
  let active = start;
  const run = async <Answer>(operation: (core: EntryCore) => Promise<Answer>): Promise<Answer> => {
    try {
      return await operation(active);
    } catch (error) {
      if (degraded) throw error;
      degraded = true;
      speak("store", `Watch history is kept for this session only: ${sentenceOfError(error)}`);
      active = memoryCore();
      return operation(active);
    }
  };
  const load = (): Promise<WatchEntry[]> => run((core) => core.load());
  /** The last seq APPLIED for the playback moves to the newest end (the oldest dropped when the room runs out). */
  const rememberSeq = (playbackId: string, seq: number): void => {
    lastSeqByPlayback.delete(playbackId);
    lastSeqByPlayback.set(playbackId, seq);
    if (lastSeqByPlayback.size > WATCH_PLAYBACKS_REMEMBERED) {
      const oldest = lastSeqByPlayback.keys().next();
      if (!oldest.done) lastSeqByPlayback.delete(oldest.value);
    }
  };
  return {
    write: (input) => run(async (core) => {
      const done = lastSeqByPlayback.get(input.playbackId) ?? 0;
      const existing = (await core.load()).find((entry) => entryIdentity(entry) === entryIdentity(input));
      // A late write answers the entry as it stands and changes nothing.
      if (input.seq <= done) return { applied: false, entry: existing ?? null };
      // The position and the state are the shared semantics: the clamp, the sticky `watched` and the
      // `watchedPercent` threshold read at this write.
      const positionMs = clampPosition(input.positionMs, input.durationMs);
      const entry: WatchEntry = {
        watchId: existing?.watchId ?? crypto.randomUUID(),
        item: input.item,
        ...(input.season === undefined ? {} : { season: input.season }),
        ...(input.episode === undefined ? {} : { episode: input.episode }),
        positionMs,
        ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
        state: entryState(existing?.state, positionMs, input.durationMs, watchedPercent()),
        updatedAt: now(),
      };
      await core.put(entry);
      // Only a landed write remembers its seq: the seq is the last APPLIED one (docs/30 section 3.13), so a write
      // whose storage failed - whose degrade retry re-runs this body - is not answered stale by its own record.
      rememberSeq(input.playbackId, input.seq);
      return { applied: true, entry };
    }),
    remove: async (watchId) => {
      // The unknown-id refusal is the store's own answer, not a storage failure: it is raised outside the guarded
      // `run`, so a missing entry never flips the store to memory or speaks the degrade warning.
      const found = (await load()).find((entry) => entry.watchId === watchId);
      if (found === undefined) throw new Error("There is no such watch entry.");
      await run((core) => core.drop(entryIdentity(found)));
      return { removed: watchId };
    },
    clear: () => run((core) => core.clearAll().then((cleared) => ({ cleared }))),
    entries: () => load(),
    continueSelection: (max) => run(async (core) => continueEntries(await core.load(), max)),
    historyPage: (page, pageSize) => run(async (core) => pageOf(newestFirst(await core.load()), page, pageSize)),
  };
}

/** Opens the store over IndexedDB - this file's one storage word - or degrades to memory with one spoken warning. */
export async function openLocalWatch(deps: LocalWatchDeps = {}): Promise<LocalWatch> {
  try {
    const database = await openIdb(deps.factory ?? browserFactory());
    return createLocalWatch(idbCore(database), deps);
  } catch (error) {
    speak("store", `Watch history is kept for this session only: ${sentenceOfError(error)}`);
    return createLocalWatch(memoryCore(), deps);
  }
}

function browserFactory(): IdbFactoryLike {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available in this browser.");
  return indexedDB;
}

let shared: Promise<LocalWatch> | null = null;

/** The one store the transport and the Library reads share, opened on first use. */
export function sharedLocalWatch(): Promise<LocalWatch> {
  shared ??= openLocalWatch();
  return shared;
}

/** Points the shared store at an injected one (tests); null restores the lazily opened browser store. */
export function setSharedLocalWatch(store: Promise<LocalWatch> | null): void {
  shared = store;
}
