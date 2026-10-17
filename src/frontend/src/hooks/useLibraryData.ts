import { useEffect, useRef, useState } from "react";
import { collectionOf, matchesQuery, type LibraryQuery, type ViewCounts } from "@/lib/library-query";
import { LibrarySearchSession, readContinue, readLibrary } from "@/services/library";
import { listCollections } from "@/services/collections";
import { useAppStore } from "@/store/app-store";
import type { LibraryItem, LibraryPage } from "@/types/library";

const aborted = (error: unknown): boolean => error instanceof DOMException && error.name === "AbortError";
const sentence = (error: unknown): string => error instanceof Error ? error.message : "Library could not be read.";

export interface LibraryData {
  readonly page: LibraryPage | null;
  readonly continuing: readonly LibraryItem[];
  readonly loading: boolean;
  readonly refresh: () => void;
}

function countFor(page: LibraryPage): number {
  return page.total ?? page.items.length;
}

export function useLibraryData(active: boolean, query: LibraryQuery, showContinue: boolean): LibraryData {
  const [page, setPage] = useState<LibraryPage | null>(null);
  const [continuing, setContinuing] = useState<readonly LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const session = useRef<LibrarySearchSession | null>(null);
  const sideRequest = useRef<AbortController | null>(null);
  const previousSearch = useRef(query.search);
  const previousActive = useRef(active);

  if (session.current === null) {
    session.current = new LibrarySearchSession(
      (answer) => {
        setPage(answer);
        setLoading(false);
        const store = useAppStore.getState();
        store.rememberLibraryItems(answer.items);
        const source = store.libraryQuery.source;
        const counts = store.libraryCounts;
        const collectionId = collectionOf(source);
        store.setLibraryCounts(collectionId === null
          ? { ...counts, [source]: countFor(answer) }
          : { ...counts, collections: { ...counts.collections, [collectionId]: countFor(answer) } });
      },
      (error) => {
        setLoading(false);
        useAppStore.getState().say(sentence(error), "warn");
      },
    );
  }

  const readSideData = (): void => {
    sideRequest.current?.abort();
    const controller = new AbortController();
    sideRequest.current = controller;
    const base = { ...query, search: "", genres: [], year: "", watched: "all" as const };
    void Promise.all([
      showContinue ? readContinue(controller.signal) : Promise.resolve([]),
      listCollections(controller.signal),
      readLibrary({ ...base, source: "all" }, controller.signal),
      readLibrary({ ...base, source: "history" }, controller.signal),
      readLibrary({ ...base, source: "favorites" }, controller.signal),
    ]).then(([nextContinue, collections, all, history, favorites]) => {
      if (sideRequest.current !== controller) return;
      const store = useAppStore.getState();
      store.setCollections(collections);
      store.rememberLibraryItems(nextContinue);
      const collectionCounts = Object.fromEntries(collections.map((row) => [row.id, row.itemCount]));
      const counts: ViewCounts = {
        all: countFor(all), history: countFor(history), favorites: countFor(favorites), collections: collectionCounts,
      };
      store.setLibraryCounts(counts);
      setContinuing(nextContinue);
    }).catch((error: unknown) => {
      if (!aborted(error)) useAppStore.getState().say(sentence(error), "warn");
    });
  };

  const read = (debounce: boolean): void => {
    setLoading(true);
    if (debounce) session.current?.search(query);
    else session.current?.readNow(query);
  };

  useEffect(() => {
    const searchChanged = previousSearch.current !== query.search;
    previousSearch.current = query.search;
    useAppStore.getState().setLibraryQuery(query);
    read(searchChanged);
  }, [query]);

  useEffect(() => {
    if (active && !previousActive.current) {
      read(false);
      readSideData();
    }
    previousActive.current = active;
  }, [active]);

  useEffect(() => {
    readSideData();
    return () => {
      session.current?.cancel();
      sideRequest.current?.abort();
    };
  }, [showContinue]);

  const continueSource = collectionOf(query.source) === null ? continuing : page?.items ?? [];
  const filteredContinue = continueSource.filter((item) => item.progress?.state === "watching" && matchesQuery({
    ...item,
    collectionIds: [],
  }, query) && (query.source !== "favorites" || item.favorite));
  return { page, continuing: filteredContinue, loading, refresh: () => { read(false); readSideData(); } };
}
