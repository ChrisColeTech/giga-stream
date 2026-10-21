import { useEffect, useRef, useState } from "react";
import { collectionOf, matchesQuery, type LibraryQuery } from "@/lib/library-query";
import { acceptCount } from "@/lib/library-counts";
import { reloadDecision } from "@/lib/library-reload";
import { LibraryFirstPageController } from "@/services/library-first-page";
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
  const firstPage = useRef<LibraryFirstPageController | null>(null);
  const searchSession = useRef<LibrarySearchSession | null>(null);
  const pagingRequest = useRef<AbortController | null>(null);
  const queryGeneration = useRef(0);
  const firstPagePending = useRef(true);
  const pagesLoaded = useRef(0);
  const previousSearch = useRef(query.search);
  const previousActive = useRef(active);
  const previousKey = useRef(libraryQueryKey(query));
  const previousSerial = useRef(refreshSerial);
  const previousSignedIn = useRef(signedIn);
  const firstPass = useRef(true);
  const dirty = useRef(false);
  const acceptFirstPage = (answer: LibraryPage): void => {
    pageRef.current = answer;
    setPage(answer);
    setAccepted({ queryKey: libraryQueryKey(useAppStore.getState().libraryQuery), serial: readSerial.current });
    firstPagePending.current = false; pagesLoaded.current = 1;
    setLoading(false);
    const store = useAppStore.getState();
    store.rememberLibraryItems(answer.items);
    acceptCount(store.libraryQuery, answer);
  };
  const refuseFirstPage = (error: unknown): void => {
    firstPagePending.current = false; setLoading(false);
    useAppStore.getState().say(sentence(error), "warn");
  };
  if (firstPage.current === null) {
    firstPage.current = new LibraryFirstPageController(acceptFirstPage, refuseFirstPage);
  }

  const read = (debounce: boolean): void => {
    queryGeneration.current += 1;
    readSerial.current = refreshSerial;
    firstPagePending.current = true;
    pagingRequest.current?.abort();
    pagingRequest.current = null;
    setPaging(false);
    /* The grid draws its first-page skeletons until the new first page lands, and nothing chains pages toward a
       stale position (no cursor, so no pager). */
    pageRef.current = null; setPage(null);
    setLoading(true);
    if (!debounce) {
      searchSession.current?.cancel();
      searchSession.current = null;
      firstPage.current?.read(query);
      return;
    }
    firstPage.current?.cancel();
    searchSession.current?.cancel();
    const generation = queryGeneration.current;
    const session = new LibrarySearchSession((answer) => {
      if (generation !== queryGeneration.current || searchSession.current !== session) return;
      searchSession.current = null;
      acceptFirstPage(answer);
    }, (error) => {
      if (generation !== queryGeneration.current || searchSession.current !== session) return;
      searchSession.current = null;
      refuseFirstPage(error);
    });
    searchSession.current = session;
    session.search(query);
  };

  const loadMore = (): boolean => {
    const cursor = page?.nextCursor;
    const key = libraryQueryKey(query);
    if (firstPagePending.current || !canLoadLibraryPage(accepted.queryKey, key, loading, paging, cursor)) return false;
    const generation = queryGeneration.current;
    const controller = new AbortController();
    pagingRequest.current?.abort();
    pagingRequest.current = controller;
    setPaging(true);
    void readLibrary(query, controller.signal, cursor).then((next) => {
      if (generation !== queryGeneration.current || pagingRequest.current !== controller) return;
      const merged = pageRef.current === null ? next : appendLibraryPage(pageRef.current, next);
      pageRef.current = merged;
      setPage(merged);
      acceptCount(query, merged);
      useAppStore.getState().rememberLibraryItems(next.items);
      pagesLoaded.current += 1;
      logLibraryPage(pagesLoaded.current, merged);
    }).catch((error: unknown) => {
      if (!aborted(error)) useAppStore.getState().say(sentence(error), "warn");
    }).finally(() => { if (pagingRequest.current === controller) setPaging(false); });
    return true;
  };

  /* The first page is read again only for an invalidation (`library-reload`): a changed query, a bumped refresh
     serial, a session that started or ended (`63` section 3.3 - the watch truth changed home). Showing it again
     reads nothing for the list, which keeps its place; only the side data refreshes quietly. */
  useEffect(() => {
    firstPass.current = true;
    firstPage.current?.setup();
    return () => {
      queryGeneration.current += 1;
      firstPage.current?.cleanup();
      searchSession.current?.cancel();
      searchSession.current = null;
      const request = pagingRequest.current;
      pagingRequest.current = null;
      request?.abort();
    };
  }, []);
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
      initial: firstPass.current, active, queryChanged, serialChanged, sessionChanged, dirty: dirty.current, ready,
    });
    if (ready) firstPass.current = false;
    dirty.current = decision.dirty;
    if (decision.reload) read(searchChanged && !shownNow);
    if (active && (shownNow || serialChanged || sessionChanged) && !decision.reload) readSideData();
  }, [query, refreshSerial, active, ready, signedIn, readSideData]);
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
