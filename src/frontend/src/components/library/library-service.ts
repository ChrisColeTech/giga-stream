import { addMember, readMemberships, removeMember } from "@/services/collections";
import { writeFavorite } from "@/services/favorites";
import { clearWatch, removeWatch } from "@/services/watch";
import { useAppStore } from "@/store/app-store";
import type { ItemRef, Membership, MembershipSource } from "@/types/library";
import { itemKey } from "@/lib/library-marks";
import type { ServiceResult } from "@/services/not-connected";

const favoriteGeneration = new Map<string, number>();
const membershipGeneration = new Map<string, number>();
const membershipReadGeneration = new Map<string, number>();
const favoriteQueue = new Map<string, Promise<void>>();
const membershipQueue = new Map<string, Promise<void>>();
const favoriteCommitted = new Map<string, boolean>();
const membershipCommitted = new Map<string, MembershipSource | undefined>();
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
      if (favoriteGeneration.get(key) === generation) {
        useAppStore.getState().setFavourite(key, answer.favorite);
        useAppStore.getState().requestLibraryRefresh();
      }
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

function storedMemberships(key: string): Membership[] {
  const state = useAppStore.getState();
  return (state.marks.memberships[key] ?? []).map((collectionId) => ({
    collectionId,
    source: state.marks.membershipSources[key]?.[collectionId] ?? "manual",
  }));
}

export async function loadMemberships(ref: ItemRef, signal?: AbortSignal): Promise<readonly Membership[]> {
  const key = itemKey(ref);
  const generation = next(membershipReadGeneration, key);
  const memberships = await readMemberships(ref, signal);
  if (membershipReadGeneration.get(key) === generation) {
    useAppStore.getState().setMemberships(key, memberships);
    return memberships;
  }
  return storedMemberships(key);
}

export async function changeMembership(
  ref: ItemRef,
  collectionId: string,
  member: boolean,
  _current?: readonly string[],
): Promise<void> {
  const item = itemKey(ref);
  const queueKey = `${item}:${collectionId}`;
  const generation = next(membershipGeneration, queueKey);
  next(membershipReadGeneration, item);
  const previous = useAppStore.getState().marks.membershipSources[item]?.[collectionId];
  if (!membershipCommitted.has(queueKey)) membershipCommitted.set(queueKey, previous);
  useAppStore.getState().setMembership(item, collectionId, member, "manual");
  const pending = membershipQueue.get(queueKey) ?? Promise.resolve();
  const write = pending.catch(() => undefined).then(async () => {
    let answer;
    try {
      answer = member ? await addMember(collectionId, ref) : await removeMember(collectionId, ref);
    } catch (error: unknown) {
      if (membershipGeneration.get(queueKey) === generation) {
        const committed = membershipCommitted.get(queueKey);
        useAppStore.getState().setMembership(item, collectionId, committed !== undefined, committed);
        useAppStore.getState().say(sentence(error), "warn");
      }
      return;
    }
    membershipCommitted.set(queueKey, member ? "manual" : undefined);
    const state = useAppStore.getState();
    state.upsertCollection(answer);
    state.requestLibraryRefresh();
    try {
      const memberships = await readMemberships(ref);
      if (membershipGeneration.get(queueKey) === generation) state.setMemberships(item, memberships);
    } catch (error: unknown) {
      if (membershipGeneration.get(queueKey) === generation) state.say(sentence(error), "warn");
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
    useAppStore.getState().requestLibraryRefresh();
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
    useAppStore.getState().requestLibraryRefresh();
    return true;
  } catch (error: unknown) {
    rollback();
    useAppStore.getState().say(sentence(error), "warn");
    return false;
  }
}
