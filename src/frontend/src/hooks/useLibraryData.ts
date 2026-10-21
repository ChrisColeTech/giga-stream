import { useEffect, useEffectEvent, useRef, useState } from "react";
import { collectionOf, matchesQuery, type LibraryQuery } from "@/lib/library-query";
import { acceptCount } from "@/lib/library-counts";
import { reloadDecision } from "@/lib/library-reload";
import {
  currentLibraryRead,
  startLibraryFirstPage,
  type LibraryReadIdentity,
} from "@/services/library-first-page";
import { logLibraryPage } from "@/services/library-log";
import { syncLibrary } from "@/services/library-refresh";
import {
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
  const sessionId = useAppStore((state) => state.session?.id ?? null);
  const { continuing, sideReady, readSideData } = useLibrarySideData(showContinue, signedIn);
  const readSideDataEffect = useEffectEvent(readSideData);
  const queryKey = libraryQueryKey(query);
  const sessionIdentity = signedIn ? `signed-in:${sessionId ?? ""}` : "signed-out";
  const renderedSession = useRef(sessionIdentity);
  const sessionGeneration = useRef(0);
  if (renderedSession.current !== sessionIdentity) {
    renderedSession.current = sessionIdentity;
    sessionGeneration.current += 1;
  }
  const currentReadIdentity = useRef<LibraryReadIdentity>({ queryKey, refreshSerial, sessionGeneration: 0 });
  currentReadIdentity.current = { queryKey, refreshSerial, sessionGeneration: sessionGeneration.current };
  const pageRef = useRef<LibraryPage | null>(null);
  const pagingRequest = useRef<AbortController | null>(null);
  const queryGeneration = useRef(0);
  const firstPagePending = useRef(true);
  const pagesLoaded = useRef(0);
  const previousSearch = useRef(query.search);
  const previousActive = useRef(active);
  const previousKey = useRef(queryKey);
  const previousSerial = useRef(refreshSerial);
  const previousSession = useRef(sessionIdentity);
  const firstPass = useRef(true);
  const replaceFirstPage = useRef(false);
  const replaceDebounced = useRef(false);
  const dirty = useRef(false);
  const acceptFirstPage = (answer: LibraryPage, answerQuery: LibraryQuery, identity: LibraryReadIdentity): void => {
    pageRef.current = answer;
    setPage(answer);
    setAccepted({ queryKey: identity.queryKey, serial: identity.refreshSerial });
    firstPagePending.current = false; pagesLoaded.current = 1;
    setLoading(false);
    const store = useAppStore.getState();
    store.rememberLibraryItems(answer.items);
    acceptCount(answerQuery, answer);
  };
  const refuseFirstPage = (error: unknown): void => {
    firstPagePending.current = false; setLoading(false);
    useAppStore.getState().say(sentence(error), "warn");
  };
  const loadMore = (): boolean => {
    const cursor = page?.nextCursor;
    const key = queryKey;
    if (firstPagePending.current || !canLoadLibraryPage(accepted.queryKey, key, loading, paging, cursor)) return false;
    const generation = queryGeneration.current;
    const identity = currentReadIdentity.current;
    const controller = new AbortController();
    pagingRequest.current?.abort();
    pagingRequest.current = controller;
    setPaging(true);
    void readLibrary(query, controller.signal, cursor).then((next) => {
      if (generation !== queryGeneration.current || pagingRequest.current !== controller
        || !currentLibraryRead(identity, currentReadIdentity.current)) return;
      const merged = pageRef.current === null ? next : appendLibraryPage(pageRef.current, next);
      pageRef.current = merged;
      setPage(merged);
      acceptCount(query, merged);
      useAppStore.getState().rememberLibraryItems(next.items);
      pagesLoaded.current += 1;
      logLibraryPage(pagesLoaded.current, merged);
    }).catch((error: unknown) => {
      if (generation !== queryGeneration.current || pagingRequest.current !== controller
        || !currentLibraryRead(identity, currentReadIdentity.current) || aborted(error)) return;
      useAppStore.getState().say(sentence(error), "warn");
    }).finally(() => {
      if (generation !== queryGeneration.current || pagingRequest.current !== controller
        || !currentLibraryRead(identity, currentReadIdentity.current)) return;
      setPaging(false);
    });
    return true;
  };

  /* The first page is read again only for an invalidation (`library-reload`): a changed query, a bumped refresh
     serial, a session that started or ended (`63` section 3.3 - the watch truth changed home). Showing it again
     reads nothing for the list, which keeps its place; only the side data refreshes quietly. */
  useEffect(() => {
    const searchChanged = previousSearch.current !== query.search;
    previousSearch.current = query.search;
    const queryChanged = previousKey.current !== queryKey;
    previousKey.current = queryKey;
    const serialChanged = previousSerial.current !== refreshSerial;
    previousSerial.current = refreshSerial;
    const sessionChanged = previousSession.current !== sessionIdentity;
    previousSession.current = sessionIdentity;
    const shownNow = active && !previousActive.current;
    previousActive.current = active;
    useAppStore.getState().setLibraryQuery(query);
    const replacing = replaceFirstPage.current;
    const decision = reloadDecision({
      initial: firstPass.current || replacing, active, queryChanged, serialChanged, sessionChanged,
      dirty: dirty.current, ready,
    });
    if (ready) firstPass.current = false;
    dirty.current = decision.dirty;
    let cleanup: (() => boolean) | undefined;
    let debounce = searchChanged && !shownNow;
    if (replacing && !searchChanged) debounce = replaceDebounced.current;
    if (decision.reload) {
      replaceFirstPage.current = false;
      queryGeneration.current += 1;
      firstPagePending.current = true;
      pagingRequest.current?.abort();
      pagingRequest.current = null;
      setPaging(false);
      /* First-page setup and ownership stay in this effect: its cleanup can cancel only this request. */
      pageRef.current = null; setPage(null);
      setLoading(true);
      const identity = currentReadIdentity.current;
      cleanup = startLibraryFirstPage({
        query, debounce, identity, currentIdentity: () => currentReadIdentity.current,
        accept: (answer) => acceptFirstPage(answer, query, identity),
        refuse: refuseFirstPage,
      });
    }
    if (active && (shownNow || serialChanged || sessionChanged) && !decision.reload) readSideDataEffect();
    return () => {
      if (cleanup?.() !== true) return;
      replaceFirstPage.current = true;
      replaceDebounced.current = debounce;
    };
  }, [query, queryKey, refreshSerial, active, ready, sessionIdentity]);
  useEffect(() => () => {
    queryGeneration.current += 1;
    const request = pagingRequest.current;
    pagingRequest.current = null;
    request?.abort();
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
  const hasMore = canLoadLibraryPage(accepted.queryKey, queryKey, loading, paging, page?.nextCursor);
  return {
    page, continuing: filtered, loading, paging, hasMore, loadMore,
    refresh: (): void => { void syncLibrary(readSideData); },
    sideReady,
    pageFor: { queryKey: accepted.queryKey, serial: accepted.serial },
  };
}
