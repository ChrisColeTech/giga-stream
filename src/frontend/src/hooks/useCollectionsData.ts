import { useEffect } from "react";
import { listCollections } from "@/services/collections";
import { listJobs } from "@/services/jobs";
import { streamFolderScan } from "@/services/scan-stream";
import { useAppStore } from "@/store/app-store";

const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not reach the fileserver.";

async function refresh(): Promise<void> {
  const [collections, jobs] = await Promise.allSettled([listCollections(), listJobs()]);
  const state = useAppStore.getState();
  if (collections.status === "fulfilled") state.setCollections(collections.value);
  if (jobs.status === "fulfilled") state.setJobs(jobs.value);
  if (collections.status === "rejected") throw collections.reason;
  if (jobs.status === "rejected") throw jobs.reason;
}

export function useCollectionsData(): void {
  const scanIds = useAppStore((state) =>
    state.collections.flatMap((collection) => collection.folders.filter((folder) => folder.scanning).map((folder) => folder.id)),
  );
  const scanKey = scanIds.join("\n");

  useEffect(() => {
    let current = true;
    void refresh().catch((error: unknown) => {
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
        .then(async () => {
          await refresh();
          useAppStore.getState().say("Folder scan finished.");
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) useAppStore.getState().say(sentence(error), "warn");
        });
      return controller;
    });
    return () => controllers.forEach((controller) => controller.abort());
  }, [scanKey]);
}
