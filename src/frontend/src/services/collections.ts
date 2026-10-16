import type { ItemRef } from "@/types/library";
import { notConnected, type ServiceResult } from "./not-connected";

/** Creates a collection (`03` section 3.7). Phase 1 stub. */
export function createCollection(_name: string): ServiceResult {
  return notConnected();
}

/** Renames a collection (`03` section 3.7). Phase 1 stub. */
export function renameCollection(_collectionId: string, _name: string): ServiceResult {
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
