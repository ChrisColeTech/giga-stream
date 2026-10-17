import type { CollectionType } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { notConnected, type ServiceResult } from "./not-connected";

/** Creates a collection with its name and type (`03` section 3.7). Phase 1 stub. */
export function createCollection(_name: string, _type: CollectionType): ServiceResult {
  return notConnected();
}

/** Saves a collection's name and type (`03` section 3.7). Phase 1 stub. */
export function updateCollection(_collectionId: string, _change: { name: string; type: CollectionType }): ServiceResult {
  return notConnected();
}

/** Removes a collection; files on disk are never touched (`03` section 3.7). Phase 1 stub. */
export function removeCollection(_collectionId: string): ServiceResult {
  return notConnected();
}

/** Removes a manual member from a collection (`03` section 3.7). Phase 1 stub. */
export function removeMember(_collectionId: string, _ref: ItemRef): ServiceResult {
  return notConnected();
}

/** Opens the native folder picker for a collection not created yet; answers the chosen folder's token and name
 *  (`POST /api/fs/dialog`, `03` section 3.8). Phase 1 stub. */
export function chooseFolder(): ServiceResult {
  return notConnected();
}

/** Attaches a folder chosen with the native picker (`03` section 3.8). Phase 1 stub. */
export function attachFolder(_collectionId: string): ServiceResult {
  return notConnected();
}

/** Replaces a folder's location and rescans it (`03` section 3.8). Phase 1 stub. */
export function replaceFolder(_folderId: string): ServiceResult {
  return notConnected();
}

/** Queues a rescan of a folder (`03` section 3.8). Phase 1 stub. */
export function rescanFolder(_folderId: string): ServiceResult {
  return notConnected();
}

/** Cancels a running scan (`03` section 3.9). Phase 1 stub. */
export function cancelScan(_folderId: string): ServiceResult {
  return notConnected();
}

/** Detaches a folder; files on disk are never touched (`03` section 3.8). Phase 1 stub. */
export function removeFolder(_folderId: string): ServiceResult {
  return notConnected();
}
