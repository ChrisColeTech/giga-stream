import { useAppStore } from "@/store/app-store";
import { chooseFolder } from "@/services/desktop";
import {
  createCollection,
  removeCollection,
  removeMember,
  updateCollection,
} from "@/services/collections";
import { attachFolder, detachFolder, replaceFolder, rescanFolder } from "@/services/folders";
import { cancelJob, listJobs } from "@/services/jobs";
import type { CollectionType, CreateCollectionResult, FolderSelection } from "@/types/collection";
import type { ItemRef } from "@/types/library";
import { isLive } from "@/types/job";

export interface CollectionVerbs {
  readonly create: (name: string, type: CollectionType, selection?: FolderSelection) => Promise<CreateCollectionResult>;
  readonly update: (collectionId: string, name: string, type: CollectionType) => Promise<boolean>;
  readonly remove: (collectionId: string) => Promise<boolean>;
  readonly attach: (collectionId: string) => Promise<boolean>;
  readonly attachSelection: (collectionId: string, selection: FolderSelection) => Promise<boolean>;
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
  const refreshJobs = async (): Promise<void> => {
    const version = store.getState().beginJobsRead();
    const jobs = await listJobs();
    store.getState().acceptJobsRead(version, jobs);
  };
  const finish = async (notice: string): Promise<true> => {
    try {
      await refreshJobs();
      store.getState().say(notice);
    } catch (error: unknown) {
      store.getState().say(`${notice} Running work could not be refreshed. ${sentence(error)}`, "warn");
    }
    return true;
  };

  return {
    create: async (name, type, selection) => {
      let created;
      try {
        created = await createCollection(name, type);
        store.getState().upsertCollection(created);
      } catch (error: unknown) {
        fail(error);
        return { outcome: "failed" };
      }
      if (selection !== undefined) {
        try {
          const folder = await attachFolder(created.id, selection.token);
          store.getState().upsertFolder(created.id, folder);
        } catch (error: unknown) {
          store
            .getState()
            .say(`${created.name} was created, but its folder was not attached. ${sentence(error)} Choose it again.`, "warn");
          return { outcome: "attach-failed", collectionId: created.id };
        }
        await finish(`${created.name} was created.`);
        return { outcome: "created" };
      }
      store.getState().say(`${created.name} was created.`);
      return { outcome: "created" };
    },
    update: async (collectionId, name, type) => {
      try {
        store.getState().upsertCollection(await updateCollection(collectionId, { name, type }));
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
        return finish("Collection removed. The original files were not changed.");
      } catch (error: unknown) {
        return fail(error);
      }
    },
    attach: async (collectionId) => folderAction(pick, collectionId, attachFolder, "Folder attached."),
    attachSelection: async (collectionId, selection) =>
      selectedFolderAction(collectionId, selection, attachFolder, "Folder attached."),
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
        return finish("Folder scan started.");
      } catch (error: unknown) {
        return fail(error);
      }
    },
    cancelScan: async (folderId) => cancelFolderScan(folderId, refreshJobs, fail),
    removeFolder: async (folderId) => {
      try {
        await detachFolder(folderId);
        store.getState().removeFolderState(folderId);
        return finish("Folder detached. The files on disk were not changed.");
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
  return selectedFolderAction(id, selection, action, notice);
}

async function cancelFolderScan(
  folderId: string,
  refresh: () => Promise<void>,
  fail: (error: unknown) => false,
): Promise<boolean> {
  try {
    await refresh();
    const state = useAppStore.getState();
    const job = state.jobs.find((item) => item.kind === "folder-scan" && item.folderId === folderId && isLive(item));
    if (job === undefined) throw new Error("That job is no longer running.");
    state.upsertJob(await cancelJob(job.id));
    try {
      await refresh();
    } catch (error: unknown) {
      state.say(`Folder scan is stopping. Running work could not be refreshed. ${sentence(error)}`, "warn");
    }
    return true;
  } catch (error: unknown) {
    return fail(error);
  }
}

async function selectedFolderAction(
  id: string,
  selection: FolderSelection,
  action: (id: string, token: string) => ReturnType<typeof attachFolder>,
  notice: string,
): Promise<boolean> {
  try {
    const folder = await action(id, selection.token);
    useAppStore.getState().upsertFolder(folder.collectionId, folder);
    try {
      const version = useAppStore.getState().beginJobsRead();
      const jobs = await listJobs();
      useAppStore.getState().acceptJobsRead(version, jobs);
      useAppStore.getState().say(notice);
    } catch (error: unknown) {
      useAppStore.getState().say(`${notice} Running work could not be refreshed. ${sentence(error)}`, "warn");
    }
    return true;
  } catch (error: unknown) {
    useAppStore.getState().say(sentence(error), "warn");
    return false;
  }
}
