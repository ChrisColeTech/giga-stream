import type { ItemRef } from "@/types/library";
import { notConnected, type ServiceResult } from "./not-connected";

/** Sets or clears a favourite (`03` section 3.12). Phase 1 stub. */
export function setFavourite(_ref: ItemRef, _favourite: boolean): ServiceResult {
  return notConnected();
}

/** Adds an item to a collection or takes it out (`03` section 3.7). Phase 1 stub. */
export function setMembership(_collectionId: string, _ref: ItemRef, _member: boolean): ServiceResult {
  return notConnected();
}

/** Starts a title or a local file in the Player (`03` sections 3.6 and 3.10). Phase 1 stub. */
export function playItem(_ref: ItemRef): ServiceResult {
  return notConnected();
}

/** Starts one exact episode of a series (`03` section 3.6: the episode's stream). Phase 1 stub. */
export function playEpisode(_ref: ItemRef, _season: number, _episode: number): ServiceResult {
  return notConnected();
}

/** Clears all watch history; favourites, collections and files are untouched (`03` section 3.13). Phase 1 stub. */
export function clearHistory(): ServiceResult {
  return notConnected();
}

/** Removes one watch entry (`03` section 3.13). Phase 1 stub. */
export function removeHistoryEntry(_watchId: string): ServiceResult {
  return notConnected();
}
