import { useAppStore } from "@/store/app-store";
import { chooseFolder, type FolderSelection } from "@/services/desktop";
import {
  createCollection,
  removeCollection,
  removeMember,
  updateCollection,
} from "@/services/collections";
import { attachFolder, detachFolder, replaceFolder, rescanFolder } from "@/services/folders";
import { cancelJob, listJobs } from "@/services/jobs";
import type { CollectionType } from "@/types/collection";
import type { ItemRef } from "@/types/library";

export interface CollectionVerbs {
  readonly create: (name: string, type: CollectionType, selection?: FolderSelection) => Promise<boolean>;
  readonly update: (collectionId: string, name: string, type: CollectionType) => Promise<boolean>;
  readonly remove: (collectionId: string) => Promise<boolean>;
  readonly attach: (collectionId: string) => Promise<boolean>;
  readonly chooseFolder: () => Promise<FolderSelection | null>;
  readonly removeMember: (collectionId: string, ref: ItemRef) => Promise<boolean>;
  readonly replace: (folderId: string) => Promise<boolean>;
  readonly rescan: (folderId: string) => Promise<boolean>;
  readonly cancelScan: (folderId: string) => Promise<boolean>;
  readonly removeFolder: (folderId: string) => Promise<boolean>;
}

const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not reach the fileserver.";

export function useCollectionVerbs(): CollectionVerbs {
  const store = useAppStore;
  const fail = (error: unknown): false => {
    store.getState().say(sentence(error), "warn");
    return false;
  };
  const pick = async (): Promise<FolderSelection | null> => {
    try {
      return await chooseFolder();
    } catch (error: unknown) {
      fail(error);
      return null;
    }
  };
  const refreshJobs = async (): Promise<void> => store.getState().setJobs(await listJobs());

  return {
    create: async (name, type, selection) => {
      try {
        const created = { ...(await createCollection(name, type)), type };
        store.getState().upsertCollection(created);
        if (selection !== undefined) {
          const folder = await attachFolder(created.id, selection.token);
          store.getState().upsertFolder(created.id, folder);
          await refreshJobs();
        }
        store.getState().say(`${created.name} was created.`);
        return true;
      } catch (error: unknown) {
        return fail(error);
      }
    },
    update: async (collectionId, name, type) => {
      try {
        store.getState().upsertCollection({ ...(await updateCollection(collectionId, { name, type })), type });
        store.getState().say("Collection details saved.");
        return true;
      } catch (error: unknown) {
        return fail(error);
      }
    },
    remove: async (collectionId) => {
      try {
        await removeCollection(collectionId);
        store.getState().removeCollectionState(collectionId);
        await refreshJobs();
        store.getState().say("Collection removed. The original files were not changed.");
        return true;
      } catch (error: unknown) {
        return fail(error);
      }
    },
    attach: async (collectionId) => folderAction(pick, collectionId, attachFolder, "Folder attached."),
    chooseFolder: pick,
    removeMember: async (collectionId, ref) => {
      try {
        store.getState().upsertCollection(await removeMember(collectionId, ref));
        store.getState().say("Video removed from the collection.");
        return true;
      } catch (error: unknown) {
        return fail(error);
      }
    },
    replace: async (folderId) => folderAction(pick, folderId, replaceFolder, "Folder location changed."),
    rescan: async (folderId) => {
      try {
        const folder = await rescanFolder(folderId);
        store.getState().upsertFolder(folder.collectionId, folder);
        await refreshJobs();
        store.getState().say("Folder scan started.");
        return true;
      } catch (error: unknown) {
        return fail(error);
      }
    },
    cancelScan: async (folderId) => cancelFolderScan(folderId, refreshJobs, fail),
    removeFolder: async (folderId) => {
      try {
        await detachFolder(folderId);
        store.getState().removeFolderState(folderId);
        await refreshJobs();
        store.getState().say("Folder detached. The files on disk were not changed.");
        return true;
      } catch (error: unknown) {
        return fail(error);
      }
    },
  };
}

async function folderAction(
  pick: () => Promise<FolderSelection | null>,
  id: string,
  action: (id: string, token: string) => ReturnType<typeof attachFolder>,
  notice: string,
): Promise<boolean> {
  const selection = await pick();
  if (selection === null) return false;
  try {
    const folder = await action(id, selection.token);
    useAppStore.getState().upsertFolder(folder.collectionId, folder);
    useAppStore.getState().setJobs(await listJobs());
    useAppStore.getState().say(notice);
    return true;
  } catch (error: unknown) {
    useAppStore.getState().say(sentence(error), "warn");
    return false;
  }
}

async function cancelFolderScan(
  folderId: string,
  refresh: () => Promise<void>,
  fail: (error: unknown) => false,
): Promise<boolean> {
  try {
    await refresh();
    const state = useAppStore.getState();
    const folder = state.collections.flatMap((collection) => collection.folders).find((item) => item.id === folderId);
    const job = state.jobs.find((item) => item.kind === "folder-scan" && item.label === `Scanning ${folder?.name}`);
    if (job === undefined) throw new Error("That job is no longer running.");
    state.upsertJob(await cancelJob(job.id));
    await refresh();
    state.say("Folder scan is stopping.");
    return true;
  } catch (error: unknown) {
    return fail(error);
  }
}
