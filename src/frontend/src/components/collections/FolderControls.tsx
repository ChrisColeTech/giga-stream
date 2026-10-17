import { CircleStop, FolderSync, RefreshCw } from "lucide-react";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { SCANNING_REASON } from "@/lib/collections-copy";
import type { CollectionFolder } from "@/types/collection";
import { CollectionIconAction } from "./CollectionIconAction";
import { FolderRemoveAction } from "./FolderRemoveAction";

/** One folder's controls in the folders table: Replace, Rescan, Cancel scan (only while scanning) and Remove. Rescan is
 *  disabled only while the folder is already scanning, when there is nothing for it to do. */
export function FolderControls({ folder }: { readonly folder: CollectionFolder }) {
  const verbs = useCollectionVerbs();
  const scanning = folder.scan === "scanning";
  return (
    <span className="inline-flex items-center justify-end gap-1">
      <CollectionIconAction icon={FolderSync} label="Replace folder" onPress={() => verbs.replace(folder.id)} />
      <CollectionIconAction
        icon={RefreshCw}
        label="Rescan folder"
        reason={scanning ? SCANNING_REASON : undefined}
        onPress={() => verbs.rescan(folder.id)}
      />
      {scanning && (
        <CollectionIconAction icon={CircleStop} label="Cancel scan" onPress={() => verbs.cancelScan(folder.id)} />
      )}
      <FolderRemoveAction folderId={folder.id} />
    </span>
  );
}
