import { useAppStore } from "@/store/app-store";
import { refreshLibrary } from "./library";

/** Library **Refresh** (`46` section E): asks the fileserver to sync its titles from the backend now, then invalidates
 *  the Library (`libraryRefreshSerial`), so the first page is read again for the query shown when the sync ends, and
 *  `onSynced` re-reads the side data. A refusal is said once on the notice line; the cache keeps serving. */
export function syncLibrary(onSynced: () => void): Promise<void> {
  return refreshLibrary().then(
    () => {
      useAppStore.getState().requestLibraryRefresh();
      onSynced();
    },
    (error: unknown) => {
      useAppStore.getState().say(error instanceof Error ? error.message : "Library could not be refreshed.", "warn");
    },
  );
}
