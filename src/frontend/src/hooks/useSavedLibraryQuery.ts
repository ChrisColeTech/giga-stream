import { useCallback, useEffect, useState } from "react";
import { DEFAULT_QUERY, type LibraryQuery, type ListView } from "@/lib/library-query";
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
  /** Changes the query; whatever of it is kept (Type, source, genres, year, watched, sort) is saved as well. */
  readonly patch: (change: Partial<LibraryQuery>) => void;
  /** Changes the view without saving it (a jump from a shelf's See all). */
  readonly setView: (view: ListView) => void;
  /** The View control: changes the view and saves it. */
  readonly changeView: (view: ListView) => void;
}

/** The Library's query and view, restored from the saved settings. The shell holds the first read until the snapshot has
 *  been applied (`ready`), so the list opens already filtered; a change made in the window is saved through the settings
 *  write-back. The search is not saved. */
export function useSavedLibraryQuery(): SavedLibraryQuery {
  const hydrated = useAppStore((state) => state.hydrationApplied);
  const ready = useAppStore((state) => state.shellVisible);
  const [query, setQuery] = useState<LibraryQuery>(savedQuery);
  const [view, setView] = useState<ListView>(() => useAppStore.getState().library.libraryView);

  /* The snapshot lands after this mounts: take the saved filters then, keeping what the person has typed. */
  useEffect(() => {
    if (!hydrated) return;
    const saved = savedQuery();
    setQuery((current) => ({ ...saved, search: current.search }));
  }, [hydrated]);

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
