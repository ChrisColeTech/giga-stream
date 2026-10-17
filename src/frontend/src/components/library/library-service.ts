import { clearHistory, playItem, removeHistoryEntry, setFavourite, setMembership } from "@/services/library";
import type { ServiceResult } from "@/services/not-connected";
import { useAppStore } from "@/store/app-store";
import type { ItemRef } from "@/types/library";
import { itemKey } from "@/lib/library-marks";

/* Every control that changes a mark calls its fileserver method first, and only a successful call changes the mark. A
 * refusal is said once on the notice line and nothing changes (`04` section 6). The store holds the marks; these
 * functions are the only place they are written from a press. */

/** Reports a refusal once on the notice line. Returns whether the call succeeded. */
export function reportRefusal(result: ServiceResult): boolean {
  if (result.ok) return true;
  useAppStore.getState().say(result.message, "warn");
  return false;
}

/** Starts a title or a local file in the Player. The Player owns what happens next. */
export function playRef(ref: ItemRef): void {
  reportRefusal(playItem(ref));
}

/** Sets a favourite. The store changes only when the fileserver accepts it. */
export function changeFavourite(ref: ItemRef, favourite: boolean): void {
  if (!reportRefusal(setFavourite(ref, favourite))) return;
  useAppStore.getState().setFavourite(itemKey(ref), favourite);
}

/** Adds an item to a collection or takes it out. The store holds the whole list, so the first change of an item writes
 *  its fixture memberships first, and the change lands on top of them. */
export function changeMembership(ref: ItemRef, collectionId: string, member: boolean, current: readonly string[]): void {
  if (!reportRefusal(setMembership(collectionId, ref, member))) return;
  const store = useAppStore.getState();
  const key = itemKey(ref);
  if (store.marks.memberships[key] === undefined) {
    for (const id of current) store.setMembership(key, id, true);
  }
  store.setMembership(key, collectionId, member);
}

/** Removes one watch entry. Returns whether the fileserver accepted it; the caller changes its own history state then. */
export function removeWatchEntry(watchId: string): boolean {
  return reportRefusal(removeHistoryEntry(watchId));
}

/** Clears all watch history. Returns whether the fileserver accepted it. */
export function clearWatchHistory(): boolean {
  return reportRefusal(clearHistory());
}
