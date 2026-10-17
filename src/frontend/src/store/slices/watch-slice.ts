import { itemKey } from "@/lib/library-marks";
import { markOf, REMOVED_MARK, type MarkedEntry, type WatchMark } from "@/lib/watch-marks";
import type { LibraryItem } from "@/types/library";

/* What the interface itself wrote to or removed from watch history, by item key (`lib/watch-marks.ts`). The Player reads
 * it so a reopened item resumes at the position just written, not at its stale snapshot. */

export interface WatchSlice {
  watchMarks: Readonly<Record<string, WatchMark>>;
  /** A write's answer: the item's newest entry. */
  rememberWatch: (entry: MarkedEntry) => void;
  /** One entry was removed: every mark and remembered item that names it stops offering its progress. */
  forgetWatch: (watchId: string) => void;
  /** History was cleared. */
  forgetAllWatch: () => void;
}

interface Host extends WatchSlice {
  libraryItems: readonly LibraryItem[];
}

type Set = (partial: Partial<WatchSlice>) => void;
type Get = () => Host;

function withTombstones(marks: WatchSlice["watchMarks"], keys: readonly string[]): WatchSlice["watchMarks"] {
  return { ...marks, ...Object.fromEntries(keys.map((key) => [key, REMOVED_MARK])) };
}

export function watchSlice(set: Set, get: Get): WatchSlice {
  return {
    watchMarks: {},
    rememberWatch: (entry) => set({ watchMarks: { ...get().watchMarks, [itemKey(entry.item)]: markOf(entry) } }),
    forgetWatch: (watchId) => {
      const { watchMarks, libraryItems } = get();
      const keys = [
        ...Object.keys(watchMarks).filter((key) => watchMarks[key]?.watchId === watchId),
        ...libraryItems.filter((item) => item.watchId === watchId).map((item) => itemKey(item.ref)),
      ];
      set({ watchMarks: withTombstones(watchMarks, keys) });
    },
    forgetAllWatch: () => {
      const { watchMarks, libraryItems } = get();
      const keys = [
        ...Object.keys(watchMarks),
        ...libraryItems.filter((item) => item.progress !== undefined).map((item) => itemKey(item.ref)),
      ];
      set({ watchMarks: withTombstones(watchMarks, keys) });
    },
  };
}
