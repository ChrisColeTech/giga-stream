import { useEffect, useRef, useState } from "react";
import { resultCount } from "@/lib/library-counts";
import { ALL_MEDIA } from "@/lib/library-media";
import { DEFAULT_QUERY, type ViewCounts } from "@/lib/library-query";
import { listCollections } from "@/services/collections";
import { readContinueRows, readLibrary } from "@/services/library";
import { emptyLibraryPage } from "@/services/library-local";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem } from "@/types/library";

const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";
const sentence = (error: unknown): string => error instanceof Error ? error.message : "Library could not be read.";

export interface LibrarySideData {
  /** The Continue strip's rows; empty signed out - there is no Continue. */
  readonly continuing: readonly LibraryItem[];
  /** The side reads have answered (the Rows view plans its shelves only once they have). */
  readonly sideReady: boolean;
  /** Reads the side data again: counts, Continue, collections - the account's rows only under a session. */
  readonly readSideData: () => void;
}

/** The Library's side reads (`63` section 3.4): signed out the account's surfaces have no truth to read - no
 *  collections list, no Continue, no history count - so those reads are simply not issued, and the history count
 *  falls back to the empty page. The catalog and favorites counts read on, whatever the session. */
export function useLibrarySideData(showContinue: boolean, signedIn: boolean): LibrarySideData {
  const [continuing, setContinuing] = useState<readonly LibraryItem[]>([]);
  const [sideReady, setSideReady] = useState(false);
  const sideRequest = useRef<AbortController | null>(null);

  const readSideData = (): void => {
    sideRequest.current?.abort();
    const controller = new AbortController();
    sideRequest.current = controller;
    const live = useAppStore.getState();
    const collectionsVersion = live.signedIn ? live.beginCollectionsRead() : null;
    const neutral = { ...DEFAULT_QUERY, scope: ALL_MEDIA, sort: "newest" as const };
    const reads = [
      showContinue && live.signedIn ? readContinueRows(controller.signal) : Promise.resolve([]),
      live.signedIn ? listCollections(controller.signal) : Promise.resolve([]),
      readLibrary({ ...neutral, source: "all" }, controller.signal),
      live.signedIn ? readLibrary({ ...neutral, source: "history" }, controller.signal)
        : Promise.resolve(emptyLibraryPage(neutral)),
      readLibrary({ ...neutral, source: "favorites" }, controller.signal),
    ] as const;
    void Promise.allSettled(reads).then((results) => {
      if (sideRequest.current !== controller) return;
      const store = useAppStore.getState();
      const [nextContinue, collections, all, history, favorites] = results;
      if (nextContinue.status === "fulfilled") {
        setContinuing(nextContinue.value);
        store.rememberLibraryItems(nextContinue.value);
      }
      const collectionsAccepted = collections.status === "fulfilled" && collectionsVersion !== null
        && store.acceptCollectionsRead(collectionsVersion, collections.value);
      const collectionCounts = collections.status === "fulfilled" && collectionsAccepted
        ? Object.fromEntries(collections.value.map((row) => [row.id, row.itemCount])) : store.libraryCounts.collections;
      const counts: ViewCounts = {
        all: resultCount(all, store.libraryCounts.all),
        history: resultCount(history, store.libraryCounts.history),
        favorites: resultCount(favorites, store.libraryCounts.favorites),
        collections: collectionCounts,
      };
      store.setLibraryCounts(counts);
      const failed = results.find((result) => result.status === "rejected" && !aborted(result.reason));
      if (failed?.status === "rejected") store.say(sentence(failed.reason), "warn");
      setSideReady(true);
    });
  };

  useEffect(() => () => sideRequest.current?.abort(), []);
  /* On mount, and again whenever the strip setting or the session changed (each read re-checks the session at call
   *  time, so a flip reads the other side of the matrix), the side data is read from scratch. */
  useEffect(() => {
    setSideReady(false);
    readSideData();
  }, [showContinue, signedIn]);
  return { continuing, sideReady, readSideData };
}
