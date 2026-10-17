import { useEffect, useRef } from "react";
import { refreshCollectionsData } from "@/hooks/useCollectionsData";
import { createScanObserver, type ScanObserver } from "@/lib/scan-observer";
import { ApiError } from "@/services/api";
import { streamFolderScan } from "@/services/scan-stream";
import { useAppStore, type AppState } from "@/store/app-store";

const sentence = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not reach the fileserver.";

export const selectScanCollections = (state: AppState): AppState["collections"] => state.collections;

export const scanningFolderIds = (collections: AppState["collections"]): string[] =>
  collections.flatMap((collection) =>
    collection.folders.filter((folder) => folder.scanning).map((folder) => folder.id),
  );

export function useScanObserver(): void {
  const collections = useAppStore(selectScanCollections);
  const scanIds = scanningFolderIds(collections);
  const scanKey = scanIds.join("\n");
  const observerRef = useRef<ScanObserver | null>(null);
  if (observerRef.current === null) {
    observerRef.current = createScanObserver({
      stream: streamFolderScan,
      refresh: refreshCollectionsData,
      setProgress: (folderId, progress) => useAppStore.getState().setScanProgress(folderId, progress),
      isMissing: (error) => error instanceof ApiError && error.code === "job.not_running",
      done: (terminal) =>
        useAppStore.getState().say(terminal === "cancelled" ? "Folder scan cancelled." : "Folder scan finished."),
      warn: (error) => useAppStore.getState().say(sentence(error), "warn"),
    });
  }
  const observer = observerRef.current;

  useEffect(() => observer.sync(scanIds), [observer, scanKey]);
  useEffect(() => () => observer.close(), [observer]);
}
