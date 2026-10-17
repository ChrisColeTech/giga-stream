import type { CollectionAnswer } from "@/services/collections";
import type { FolderAnswer } from "@/services/folders";
import type { CollectionFolder, CollectionRow, ScanProgress } from "@/types/collection";

export function collectionRow(collection: CollectionAnswer): CollectionRow {
  return {
    id: collection.id,
    name: collection.name,
    type: collection.type ?? "local",
    total: collection.itemCount,
    manual: Math.max(0, collection.itemCount - collection.folders.reduce((sum, folder) => sum + folder.fileCount, 0)),
    folders: collection.folders.length,
    scan: collection.scanning ? "scanning" : "idle",
  };
}

export function collectionFolder(folder: FolderAnswer, progress?: ScanProgress): CollectionFolder {
  return {
    id: folder.id,
    name: folder.name,
    indexedCount: progress?.found ?? folder.fileCount,
    scan: folder.scanning && !progress?.done ? "scanning" : "idle",
    ...(folder.lastScannedAt === undefined ? {} : { lastScanAt: folder.lastScannedAt }),
  };
}
