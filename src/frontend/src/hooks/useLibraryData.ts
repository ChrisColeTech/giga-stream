import { useEffect, useRef, useState } from "react";
import { DEFAULT_QUERY, collectionOf, matchesQuery, type LibraryQuery, type ViewCounts } from "@/lib/library-query";
import {
  LibrarySearchSession,
  appendLibraryPage,
  canLoadLibraryPage,
  libraryQueryKey,
  readContinue,
  readLibrary,
} from "@/services/library";
import { listCollections } from "@/services/collections";
import { acceptCount, resultCount } from "@/lib/library-counts";
import { reloadDecision } from "@/lib/library-reload";
import { logLibraryPage } from "@/services/library-log";
import { useAppStore } from "@/store/app-store";
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
}

/** `ready` holds the first read until the saved Library state has been applied to `query`. */
export function useLibraryData(
  active: boolean, query: LibraryQuery, showContinue: boolean, ready: boolean,
): LibraryData {
  const [page, setPage] = useState<LibraryPage | null>(null);
  const [continuing, setContinuing] = useState<readonly LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [acceptedQueryKey, setAcceptedQueryKey] = useState<string | null>(null);
  const pageRef = useRef<LibraryPage | null>(null);
  const session = useRef<LibrarySearchSession | null>(null);
  const sideRequest = useRef<AbortController | null>(null);
  const pageRequest = useRef<AbortController | null>(null);
  const queryGeneration = useRef(0);
  const firstPagePending = useRef(true);
  const pagesLoaded = useRef(0);
  const previousSearch = useRef(query.search);
  const previousActive = useRef(active);
  const refreshSerial = useAppStore((state) => state.libraryRefreshSerial);
  const previousKey = useRef(libraryQueryKey(query));
  const previousSerial = useRef(refreshSerial);
  const firstPass = useRef(true);
  const dirty = useRef(false);

  if (session.current === null) {
    session.current = new LibrarySearchSession(
      (answer) => {
        pageRef.current = answer;
        setPage(answer);
        setAcceptedQueryKey(libraryQueryKey(useAppStore.getState().libraryQuery));
        firstPagePending.current = false;
        pagesLoaded.current = 1;
        setLoading(false);
        const store = useAppStore.getState();
        store.rememberLibraryItems(answer.items);
        acceptCount(store.libraryQuery, answer);
      },
      (error) => {
        firstPagePending.current = false;
        setLoading(false);
        useAppStore.getState().say(sentence(error), "warn");
      },
    );
  }

  const readSideData = (): void => {
    sideRequest.current?.abort();
    const controller = new AbortController();
    sideRequest.current = controller;
    const collectionsVersion = useAppStore.getState().beginCollectionsRead();
    const neutral = { ...DEFAULT_QUERY, scope: "all" as const, sort: "newest" as const };
    const reads = [
      showContinue ? readContinue(controller.signal) : Promise.resolve([]),
      listCollections(controller.signal),
      readLibrary({ ...neutral, source: "all" }, controller.signal),
      readLibrary({ ...neutral, source: "history" }, controller.signal),
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
      const collectionsAccepted = collections.status === "fulfilled"
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
    });
  };

  const read = (debounce: boolean): void => {
    queryGeneration.current += 1;
    firstPagePending.current = true;
    pageRequest.current?.abort();
    setPaging(false);
    /* The loaded list goes: the grid draws its first-page skeletons until the new first page lands, and nothing can
       chain pages toward a stale position (no cursor, so no pager). */
    pageRef.current = null;
    setPage(null);
    setLoading(true);
    if (debounce) session.current?.search(query);
    else session.current?.readNow(query);
  };

  const loadMore = (): boolean => {
    const cursor = page?.nextCursor;
    const key = libraryQueryKey(query);
    if (firstPagePending.current || !canLoadLibraryPage(acceptedQueryKey, key, loading, paging, cursor)) return false;
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

  /* The first page is read again only for an invalidation (`library-reload`): a changed query or a bumped refresh
     serial, applied when the Library is shown. Showing it again reads nothing for the list, which keeps its place;
     only the side data (counts, Continue) refreshes quietly. */
  useEffect(() => {
    const searchChanged = previousSearch.current !== query.search;
    previousSearch.current = query.search;
    const queryChanged = previousKey.current !== libraryQueryKey(query);
    previousKey.current = libraryQueryKey(query);
    const serialChanged = previousSerial.current !== refreshSerial;
    previousSerial.current = refreshSerial;
    const shownNow = active && !previousActive.current;
    previousActive.current = active;
    useAppStore.getState().setLibraryQuery(query);
    const decision = reloadDecision({
      initial: firstPass.current, active, queryChanged, serialChanged, dirty: dirty.current, ready,
    });
    if (ready) firstPass.current = false;
    dirty.current = decision.dirty;
    if (decision.reload) read(searchChanged && !shownNow);
    if (active && (shownNow || serialChanged) && !decision.reload) readSideData();
  }, [query, refreshSerial, active, ready]);
  useEffect(() => {
    readSideData();
    return () => { session.current?.cancel(); sideRequest.current?.abort(); pageRequest.current?.abort(); };
  }, [showContinue]);

  const source = collectionOf(query.source) === null ? continuing : page?.items ?? [];
  const filtered = source.filter((item) => item.progress?.state === "watching" && matchesQuery({
    ...item, collectionIds: [], collectionSources: {},
  }, query) && (query.source !== "favorites" || item.favorite));
  const hasMore = canLoadLibraryPage(
    acceptedQueryKey,
    libraryQueryKey(query),
    loading,
    paging,
    page?.nextCursor,
  );
  return {
    page,
    continuing: filtered,
    loading,
    paging,
    hasMore,
    loadMore,
    refresh: () => { read(false); readSideData(); },
  };
}
