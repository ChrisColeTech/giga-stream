import { useSyncExternalStore } from "react";
import { MEMBERSHIP } from "@/fixtures/collections";
import { LIBRARY_ITEMS } from "@/fixtures/titles";
import {
  clearHistory as markHistoryCleared,
  removeWatch as markWatchRemoved,
  seedMarks,
  setFavorite as markFavorite,
  setMembership as markMembership,
  type Marks,
} from "@/lib/library-marks";
import { clearHistory as clearHistoryCall, removeHistoryEntry, setFavourite, setMembership as setMembershipCall } from "@/services/library";
import type { ItemRef } from "@/types/library";
import { reportRefusal } from "./library-service";

/* The marks a person sets are read by the Library and by Title information, which are separate trees, so they live here
 * as one value read through useSyncExternalStore. Each action calls its fileserver method first and changes the mark only
 * when the call succeeds; a refusal is said once on the notice line. The app store is the one Zustand store and is not
 * changed here. */

let current: Marks = seedMarks(LIBRARY_ITEMS, MEMBERSHIP);
const listeners = new Set<() => void>();

function commit(next: Marks): void {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(): Marks {
  return current;
}

export function useMarks(): Marks {
  return useSyncExternalStore(subscribe, read);
}

export function setFavorite(ref: ItemRef, value: boolean): void {
  if (!reportRefusal(setFavourite(ref, value))) return;
  commit(markFavorite(current, ref.id, value));
}

export function setMembership(ref: ItemRef, collectionId: string, member: boolean): void {
  if (!reportRefusal(setMembershipCall(collectionId, ref, member))) return;
  commit(markMembership(current, ref.id, collectionId, member));
}

export function removeWatch(ref: ItemRef, watchId: string): void {
  if (!reportRefusal(removeHistoryEntry(watchId))) return;
  commit(markWatchRemoved(current, ref.id));
}

export function clearHistory(): void {
  if (!reportRefusal(clearHistoryCall())) return;
  commit(markHistoryCleared(current));
}
