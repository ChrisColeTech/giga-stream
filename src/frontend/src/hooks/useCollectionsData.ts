import { useEffect } from "react";
import { listCollections } from "@/services/collections";
import { listJobs } from "@/services/jobs";
import { streamFolderScan } from "@/services/scan-stream";
import { ApiError } from "@/services/api";
import { useAppStore } from "@/store/app-store";

const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not reach the fileserver.";

export async function refreshCollectionsData(): Promise<void> {
  const before = useAppStore.getState();
  const collectionsVersion = before.beginCollectionsRead();
  const jobsVersion = before.beginJobsRead();
  const [collections, jobs] = await Promise.allSettled([listCollections(), listJobs()]);
  const state = useAppStore.getState();
  if (collections.status === "fulfilled") state.acceptCollectionsRead(collectionsVersion, collections.value);
  if (jobs.status === "fulfilled") state.acceptJobsRead(jobsVersion, jobs.value);
  if (collections.status === "rejected") throw collections.reason;
  if (jobs.status === "rejected") throw jobs.reason;
}

export async function recoverMissingScan(error: unknown): Promise<boolean> {
  if (!(error instanceof ApiError) || error.code !== "job.not_running") return false;
  await refreshCollectionsData();
  return true;
}

export function useCollectionsData(): void {
  const scanIds = useAppStore((state) =>
    state.collections.flatMap((collection) => collection.folders.filter((folder) => folder.scanning).map((folder) => folder.id)),
  );
  const scanKey = scanIds.join("\n");

  useEffect(() => {
    let current = true;
    void refreshCollectionsData().catch((error: unknown) => {
      if (current) useAppStore.getState().say(sentence(error), "warn");
    });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    const controllers = scanIds.map((folderId) => {
      const controller = new AbortController();
      void streamFolderScan(
        folderId,
        (progress) => useAppStore.getState().setScanProgress(folderId, progress),
        controller.signal,
      )
        .then(async (terminal) => {
          await refreshCollectionsData();
          useAppStore.getState().say(terminal === "cancelled" ? "Folder scan cancelled." : "Folder scan finished.");
        })
        .catch(async (error: unknown) => {
          if (controller.signal.aborted) return;
          try {
            if (await recoverMissingScan(error)) return;
            useAppStore.getState().say(sentence(error), "warn");
          } catch (refreshError: unknown) {
            useAppStore.getState().say(sentence(refreshError), "warn");
          }
        });
      return controller;
    });
    return () => controllers.forEach((controller) => controller.abort());
  }, [scanKey]);
}
