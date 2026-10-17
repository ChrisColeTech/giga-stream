import { addMember, readMemberships, removeMember } from "@/services/collections";
import { writeFavorite } from "@/services/favorites";
import { clearWatch, removeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";
import type { ItemRef } from "@/types/library";
import { itemKey } from "@/lib/library-marks";
import type { ServiceResult } from "@/services/not-connected";

const favoriteGeneration = new Map<string, number>();
const membershipGeneration = new Map<string, number>();
const favoriteQueue = new Map<string, Promise<void>>();
const membershipQueue = new Map<string, Promise<void>>();
const favoriteCommitted = new Map<string, boolean>();
const membershipCommitted = new Map<string, boolean>();
const sentence = (error: unknown): string => error instanceof Error ? error.message : "Could not reach the fileserver.";

function next(map: Map<string, number>, key: string): number {
  const generation = (map.get(key) ?? 0) + 1;
  map.set(key, generation);
  return generation;
}

export function playRef(ref: ItemRef): void {
  useAppStore.getState().requestPlay(ref);
}

export function reportRefusal(result: ServiceResult): boolean {
  if (result.ok) return true;
  useAppStore.getState().say(result.message, "warn");
  return false;
}

export async function changeFavourite(ref: ItemRef, favorite: boolean): Promise<void> {
  const key = itemKey(ref);
  const generation = next(favoriteGeneration, key);
  const store = useAppStore.getState();
  const previous = store.marks.favourites[key] ?? store.libraryItems.find((item) => itemKey(item.ref) === key)?.favorite ?? false;
  if (!favoriteCommitted.has(key)) favoriteCommitted.set(key, previous);
  store.setFavourite(key, favorite);
  const pending = favoriteQueue.get(key) ?? Promise.resolve();
  const write = pending.catch(() => undefined).then(async () => {
    try {
      const answer = await writeFavorite(ref, favorite);
      favoriteCommitted.set(key, answer.favorite);
      if (favoriteGeneration.get(key) === generation) useAppStore.getState().setFavourite(key, answer.favorite);
    } catch (error: unknown) {
      if (favoriteGeneration.get(key) === generation) {
        useAppStore.getState().setFavourite(key, favoriteCommitted.get(key) ?? previous);
        useAppStore.getState().say(sentence(error), "warn");
      }
    }
  });
  favoriteQueue.set(key, write);
  await write;
}

export async function loadMemberships(ref: ItemRef, signal?: AbortSignal): Promise<readonly string[]> {
  const key = itemKey(ref);
  const generation = next(membershipGeneration, key);
  const ids = await readMemberships(ref, signal);
  if (membershipGeneration.get(key) === generation) {
    useAppStore.getState().setMemberships(key, ids);
    return ids;
  }
  return useAppStore.getState().marks.memberships[key] ?? [];
}

export async function changeMembership(
  ref: ItemRef,
  collectionId: string,
  member: boolean,
  _current?: readonly string[],
): Promise<void> {
  const item = itemKey(ref);
  const generation = next(membershipGeneration, item);
  const queueKey = `${item}:${collectionId}`;
  const current = useAppStore.getState().marks.memberships[item] ?? [];
  const previous = current.includes(collectionId);
  if (!membershipCommitted.has(queueKey)) membershipCommitted.set(queueKey, previous);
  useAppStore.getState().setMembership(item, collectionId, member);
  const pending = membershipQueue.get(queueKey) ?? Promise.resolve();
  const write = pending.catch(() => undefined).then(async () => {
    try {
      const answer = member ? await addMember(collectionId, ref) : await removeMember(collectionId, ref);
      membershipCommitted.set(queueKey, member);
      if (membershipGeneration.get(item) === generation) useAppStore.getState().upsertCollection(answer);
    } catch (error: unknown) {
      if (membershipGeneration.get(item) === generation) {
        useAppStore.getState().setMembership(item, collectionId, membershipCommitted.get(queueKey) ?? previous);
        useAppStore.getState().say(sentence(error), "warn");
      }
    }
  });
  membershipQueue.set(queueKey, write);
  await write;
}

export async function removeWatchEntry(
  watchId: string,
  optimistic: () => void = () => undefined,
  rollback: () => void = () => undefined,
): Promise<boolean> {
  optimistic();
  try {
    await removeWatch(watchId);
    return true;
  } catch (error: unknown) {
    rollback();
    useAppStore.getState().say(sentence(error), "warn");
    return false;
  }
}

export async function clearWatchHistory(
  optimistic: () => void = () => undefined,
  rollback: () => void = () => undefined,
): Promise<boolean> {
  optimistic();
  try {
    await clearWatch();
    return true;
  } catch (error: unknown) {
    rollback();
    useAppStore.getState().say(sentence(error), "warn");
    return false;
  }
}
