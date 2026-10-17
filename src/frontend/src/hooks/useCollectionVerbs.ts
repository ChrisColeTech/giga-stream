import { useMemo } from "react";
import {
  attachFolder,
  cancelScan,
  chooseFolder,
  createCollection,
  removeCollection,
  removeFolder,
  removeMember,
  renameCollection,
  replaceFolder,
  rescanFolder,
} from "@/services/collections";
import type { ServiceResult } from "@/services/not-connected";
import { useAppStore } from "@/store/app-store";
import type { ItemRef } from "@/types/library";

/** The Collections window's verbs. Each calls its fileserver method and answers whether it succeeded. A refusal is reported
 *  once on the notice line and changes nothing (`04` section 6). */
export interface CollectionVerbs {
  readonly create: (name: string) => boolean;
  readonly rename: (collectionId: string, name: string) => boolean;
  readonly remove: (collectionId: string) => boolean;
  readonly attach: (collectionId: string) => boolean;
  /** Picks a folder for a collection being created. */
  readonly chooseFolder: () => boolean;
  readonly removeMember: (collectionId: string, ref: ItemRef) => boolean;
  readonly replace: (folderId: string) => boolean;
  readonly rescan: (folderId: string) => boolean;
  readonly cancelScan: (folderId: string) => boolean;
  readonly removeFolder: (folderId: string) => boolean;
}

export function useCollectionVerbs(): CollectionVerbs {
  const say = useAppStore((state) => state.say);
  return useMemo(() => {
    const report = (result: ServiceResult): boolean => {
      if (!result.ok) say(result.message, "warn");
      return result.ok;
    };
    return {
      create: (name) => report(createCollection(name)),
      rename: (collectionId, name) => report(renameCollection(collectionId, name)),
      remove: (collectionId) => report(removeCollection(collectionId)),
      attach: (collectionId) => report(attachFolder(collectionId)),
      chooseFolder: () => report(chooseFolder()),
      removeMember: (collectionId, ref) => report(removeMember(collectionId, ref)),
      replace: (folderId) => report(replaceFolder(folderId)),
      rescan: (folderId) => report(rescanFolder(folderId)),
      cancelScan: (folderId) => report(cancelScan(folderId)),
      removeFolder: (folderId) => report(removeFolder(folderId)),
    };
  }, [say]);
}
