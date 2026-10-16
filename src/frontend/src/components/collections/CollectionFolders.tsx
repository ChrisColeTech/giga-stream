import { CircleStop, Folder, FolderMinus, FolderPlus, FolderSync, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { Group } from "@/components/ui/Group";
import { Strip } from "@/components/ui/Strip";
import {
  ATTACH_REASON,
  CANCEL_SCAN_REASON,
  REMOVE_FOLDER_REASON,
  REPLACE_REASON,
  RESCAN_REASON,
} from "@/lib/collections-copy";
import { lastScanLabel } from "@/lib/collections-scan";
import type { CollectionFolder } from "@/types/collection";
import { CollectionIconAction } from "./CollectionIconAction";
import { ScanState } from "./ScanState";

const COLUMNS: ReadonlyArray<Column<CollectionFolder>> = [
  { key: "name", label: "folder", cell: (folder) => folder.name },
  { key: "indexed", label: "indexed", align: "right", width: "72px", cell: (folder) => folder.indexedCount },
  { key: "scan", label: "scan", width: "112px", cell: (folder) => <ScanState scan={folder.scan} /> },
  { key: "last", label: "last scan", width: "136px", cell: (folder) => lastScanLabel(folder.lastScanAt) },
  {
    key: "controls",
    label: "",
    align: "right",
    width: "148px",
    /* Cancel scan is drawn only while the folder's scan runs; the other three are always there. */
    cell: (folder) => (
      <span className="inline-flex items-center justify-end gap-1">
        <CollectionIconAction icon={FolderSync} label="Replace folder" reason={REPLACE_REASON} />
        <CollectionIconAction icon={RefreshCw} label="Rescan folder" reason={RESCAN_REASON} />
        {folder.scan === "scanning" && (
          <CollectionIconAction icon={CircleStop} label="Cancel scan" reason={CANCEL_SCAN_REASON} />
        )}
        <CollectionIconAction icon={FolderMinus} label="Remove folder" reason={REMOVE_FOLDER_REASON} />
      </span>
    ),
  },
];

/** The folders attached to one collection (`03` section 3.8). Their locations are never shown, only their names. */
export function CollectionFolders({ folders }: { readonly folders: readonly CollectionFolder[] }) {
  return (
    <Group
      id="collections.folders"
      title="Folders"
      icon={Folder}
      tip="The folders this collection is built from. Files on disk are only read, never changed."
    >
      <DataTable label="Folders" columns={COLUMNS} rows={folders} rowKey={(folder) => folder.id} />
      <Strip>
        <Button disabled title={ATTACH_REASON}>
          <FolderPlus className="size-3.5" />
          Attach folder
        </Button>
      </Strip>
    </Group>
  );
}
