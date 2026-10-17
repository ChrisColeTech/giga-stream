import { libraryEndEvent, libraryPageEvent } from "@/lib/library-events";
import { useAppStore } from "@/store/app-store";
import type { LibraryPage } from "@/types/library";

/** Writes the paging events into the Events drawer: the appended page, then the end when no cursor remains. */
export function logLibraryPage(pageNumber: number, merged: LibraryPage): void {
  const log = useAppStore.getState().logEvent;
  log(libraryPageEvent(pageNumber, merged.items.length, merged.total));
  if (merged.nextCursor === undefined) log(libraryEndEvent(merged.items.length));
}
