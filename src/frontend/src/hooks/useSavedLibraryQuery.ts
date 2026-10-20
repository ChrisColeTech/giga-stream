import { useCallback, useEffect, useState } from "react";
import { DEFAULT_QUERY, collectionOf, type LibraryQuery, type ListView } from "@/lib/library-query";
import { restoredQuery, savedChange } from "@/lib/library-restore";
import { useAppStore } from "@/store/app-store";

function savedQuery(): LibraryQuery {
  const { library, collections } = useAppStore.getState();
  return { ...DEFAULT_QUERY, ...restoredQuery(library, collections.map((collection) => collection.id)) };
}

/** Signed out, the account's views do not exist (`63` section 3.4): a saved History or collection source reads as
 *  All, the rail's own rows for it being unrendered. */
function clampedSource(source: LibraryQuery["source"], signedIn: boolean): LibraryQuery["source"] {
  if (signedIn) return source;
  return source === "history" || collectionOf(source) !== null ? "all" : source;
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
      source: clampedSource(saved.source, useAppStore.getState().signedIn),
      search: current.search !== "" ? current.search : saved.search,
    }));
  }, [hydrated]);

  /* A session that ends under the app leaves the account's views: out of History, out of any collection. */
  useEffect(() => {
    if (signedIn) return;
    setQuery((current) => {
      const source = clampedSource(current.source, signedIn);
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

  return { query, view, ready, patch, setView, changeView };
}
