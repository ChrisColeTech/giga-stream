import { useCallback, useEffect, useState } from "react";
import { DEFAULT_QUERY, sourceForSession, type LibraryQuery, type ListView } from "@/lib/library-query";
import { restoredQuery, savedChange } from "@/lib/library-restore";
import { useAppStore } from "@/store/app-store";

function savedQuery(): LibraryQuery {
  const { library, collections } = useAppStore.getState();
  return { ...DEFAULT_QUERY, ...restoredQuery(library, collections.map((collection) => collection.id)) };
}

export interface SavedLibraryQuery {
  readonly query: LibraryQuery;
  readonly view: ListView;
  /** The saved state has been applied (or the shell gave up waiting for it): the first read may go. */
  readonly ready: boolean;
  /** Changes the query; whatever of it is kept (Type, source, Filter text, genres, year, watched, sort) is saved too. */
  readonly patch: (change: Partial<LibraryQuery>) => void;
  /** Changes the view without saving it (a jump from a shelf's See all). */
  readonly setView: (view: ListView) => void;
  /** The View control: changes the view and saves it. */
  readonly changeView: (view: ListView) => void;
}

/** The Library's query and view, restored from the saved settings. The shell holds the first read until the snapshot has
 *  been applied (`ready`), so the list opens already filtered; a change made in the window is saved through the settings
 *  write-back, the Filter text as well (owner, 2026-10-18). */
export function useSavedLibraryQuery(): SavedLibraryQuery {
  const hydrated = useAppStore((state) => state.hydrationApplied);
  const ready = useAppStore((state) => state.shellVisible);
  const signedIn = useAppStore((state) => state.signedIn);
  const [query, setQuery] = useState<LibraryQuery>(savedQuery);
  const [view, setView] = useState<ListView>(() => useAppStore.getState().library.libraryView);

  /* The snapshot lands after this mounts: take the saved filters then, the saved Filter text included, unless the person
   * has already typed one. */
  useEffect(() => {
    if (!hydrated) return;
    const saved = savedQuery();
    setQuery((current) => ({
      ...saved,
      source: sourceForSession(saved.source, useAppStore.getState().signedIn),
      search: current.search !== "" ? current.search : saved.search,
    }));
  }, [hydrated]);

  /* A session that ends under the app leaves the account's views: out of History, out of any collection. */
  useEffect(() => {
    if (signedIn) return;
    setQuery((current) => {
      const source = sourceForSession(current.source, signedIn);
      return source === current.source ? current : { ...current, source };
    });
  }, [signedIn]);

  const patch = useCallback((change: Partial<LibraryQuery>) => {
    setQuery((current) => ({ ...current, ...change }));
    const store = useAppStore.getState();
    if (!store.hydrationApplied) return;
    const kept = savedChange(change, store.library);
    if (Object.keys(kept).length > 0) store.setLibraryPrefs(kept);
  }, []);

  const changeView = useCallback((next: ListView) => {
    setView(next);
    const store = useAppStore.getState();
    if (store.hydrationApplied && store.library.libraryView !== next) store.setLibraryPrefs({ libraryView: next });
  }, []);

  const availableSource = sourceForSession(query.source, signedIn);
  const availableQuery = availableSource === query.source ? query : { ...query, source: availableSource };
  return { query: availableQuery, view, ready, patch, setView, changeView };
}
