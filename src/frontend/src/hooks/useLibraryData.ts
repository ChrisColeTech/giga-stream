import { useEffect, useRef, useState } from "react";
import { collectionOf, matchesQuery, type LibraryQuery } from "@/lib/library-query";
import { acceptCount } from "@/lib/library-counts";
import { reloadDecision } from "@/lib/library-reload";
import { logLibraryPage } from "@/services/library-log";
import { syncLibrary } from "@/services/library-refresh";
import {
  LibrarySearchSession,
  appendLibraryPage,
  canLoadLibraryPage,
  libraryQueryKey,
  readLibrary,
} from "@/services/library";
import { useAppStore } from "@/store/app-store";
import { useLibrarySideData } from "./useLibrarySideData";
import type { LibraryItem, LibraryPage } from "@/types/library";

const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";
const sentence = (error: unknown): string => error instanceof Error ? error.message : "Library could not be read.";

export interface LibraryData {
  readonly page: LibraryPage | null;
  readonly continuing: readonly LibraryItem[];
  readonly loading: boolean;
  readonly paging: boolean;
  readonly hasMore: boolean;
  /** Requests the next page; answers whether one really was requested. */
  readonly loadMore: () => boolean;
  readonly refresh: () => void;
  /** The side reads have answered (the Rows view plans its shelves only once they have). */
  readonly sideReady: boolean;
  /** The query key and refresh serial the held page was read for; null before any page. */
  readonly pageFor: { readonly queryKey: string | null; readonly serial: number | null };
}

/** `ready` holds the first read until the saved Library state has been applied to `query`. */
export function useLibraryData(
  active: boolean, query: LibraryQuery, showContinue: boolean, ready: boolean,
): LibraryData {
  const [page, setPage] = useState<LibraryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [accepted, setAccepted] = useState<{ readonly queryKey: string | null; readonly serial: number | null }>(
    { queryKey: null, serial: null });
  const refreshSerial = useAppStore((state) => state.libraryRefreshSerial);
  const signedIn = useAppStore((state) => state.signedIn);
  const { continuing, sideReady, readSideData } = useLibrarySideData(showContinue, signedIn);
  const readSerial = useRef(0);
  const pageRef = useRef<LibraryPage | null>(null);
  const session = useRef<LibrarySearchSession | null>(null);
  const pageRequest = useRef<AbortController | null>(null);
  const queryGeneration = useRef(0);
  const firstPagePending = useRef(true);
  const pagesLoaded = useRef(0);
  const previousSearch = useRef(query.search);
  const previousActive = useRef(active);
  const previousKey = useRef(libraryQueryKey(query));
  const previousSerial = useRef(refreshSerial);
  const previousSignedIn = useRef(signedIn);
  const firstPass = useRef(true);
  const interrupted = useRef(false);
  const dirty = useRef(false);
  if (session.current === null) {
    session.current = new LibrarySearchSession(
      (answer) => {
        pageRef.current = answer;
        setPage(answer);
        setAccepted({ queryKey: libraryQueryKey(useAppStore.getState().libraryQuery), serial: readSerial.current });
        firstPagePending.current = false; pagesLoaded.current = 1;
        setLoading(false);
        const store = useAppStore.getState();
        store.rememberLibraryItems(answer.items);
        acceptCount(store.libraryQuery, answer);
      },
      (error) => {
        firstPagePending.current = false; setLoading(false);
        useAppStore.getState().say(sentence(error), "warn");
      },
    );
  }

  const read = (debounce: boolean): void => {
    queryGeneration.current += 1;
    readSerial.current = refreshSerial;
    firstPagePending.current = true;
    pageRequest.current?.abort();
    setPaging(false);
    /* The grid draws its first-page skeletons until the new first page lands, and nothing chains pages toward a
       stale position (no cursor, so no pager). */
    pageRef.current = null; setPage(null);
    setLoading(true);
    if (debounce) session.current?.search(query);
    else session.current?.readNow(query);
  };

  const loadMore = (): boolean => {
    const cursor = page?.nextCursor;
    const key = libraryQueryKey(query);
    if (firstPagePending.current || !canLoadLibraryPage(accepted.queryKey, key, loading, paging, cursor)) return false;
    const generation = queryGeneration.current;
    const controller = new AbortController();
    pageRequest.current?.abort();
    pageRequest.current = controller;
    setPaging(true);
    void readLibrary(query, controller.signal, cursor).then((next) => {
      if (generation !== queryGeneration.current || pageRequest.current !== controller) return;
      const merged = pageRef.current === null ? next : appendLibraryPage(pageRef.current, next);
      pageRef.current = merged;
      setPage(merged);
      acceptCount(query, merged);
      useAppStore.getState().rememberLibraryItems(next.items);
      pagesLoaded.current += 1;
      logLibraryPage(pagesLoaded.current, merged);
    }).catch((error: unknown) => {
      if (!aborted(error)) useAppStore.getState().say(sentence(error), "warn");
    }).finally(() => { if (pageRequest.current === controller) setPaging(false); });
    return true;
  };

  /* The first page is read again only for an invalidation (`library-reload`): a changed query, a bumped refresh
     serial, a session that started or ended (`63` section 3.3 - the watch truth changed home). Showing it again
     reads nothing for the list, which keeps its place; only the side data refreshes quietly. */
  useEffect(() => {
    const searchChanged = previousSearch.current !== query.search;
    previousSearch.current = query.search;
    const queryChanged = previousKey.current !== libraryQueryKey(query);
    previousKey.current = libraryQueryKey(query);
    const serialChanged = previousSerial.current !== refreshSerial;
    previousSerial.current = refreshSerial;
    const sessionChanged = previousSignedIn.current !== signedIn;
    previousSignedIn.current = signedIn;
    const shownNow = active && !previousActive.current;
    previousActive.current = active;
    useAppStore.getState().setLibraryQuery(query);
    const decision = reloadDecision({
      initial: firstPass.current, interrupted: interrupted.current, active, queryChanged, serialChanged, sessionChanged,
      dirty: dirty.current, ready,
    });
    if (ready) firstPass.current = false;
    dirty.current = decision.dirty;
    if (decision.reload) {
      interrupted.current = false;
      read(searchChanged && !shownNow);
    }
    if (active && (shownNow || serialChanged || sessionChanged) && !decision.reload) readSideData();
  }, [query, refreshSerial, active, ready, signedIn, readSideData]);
  useEffect(() => () => {
    interrupted.current = true;
    session.current?.cancel();
    pageRequest.current?.abort();
  }, []);
  /* The statusbar's bar reads the store (`50` section 2.3): busy while a read or a paging read is in flight. */
  useEffect(() => {
    useAppStore.getState().setActivity("library", loading || paging);
    return () => useAppStore.getState().setActivity("library", false);
  }, [loading, paging]);

  const source = collectionOf(query.source) === null ? continuing : page?.items ?? [];
  const filtered = source.filter((item) => item.progress?.state === "watching" && matchesQuery({
    ...item, collectionIds: [], collectionSources: {},
  }, query) && (query.source !== "favorites" || item.favorite));
  const hasMore = canLoadLibraryPage(accepted.queryKey, libraryQueryKey(query), loading, paging, page?.nextCursor);
  return {
    page, continuing: filtered, loading, paging, hasMore, loadMore,
    refresh: (): void => { void syncLibrary(readSideData); },
    sideReady,
    pageFor: { queryKey: accepted.queryKey, serial: accepted.serial },
  };
}
