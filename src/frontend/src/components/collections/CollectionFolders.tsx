import { Folder, FolderPlus } from "lucide-react";
import { Button } from "@giga/ui/controls/Button";
import { DataTable } from "@giga/ui/lists/DataTable";
import type { Column } from "@giga/ui/lists/DataTable";
import { Actions } from "@giga/ui/form/Actions";
import { Group } from "@giga/ui/form/Group";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { SKELETON_ROW_COUNT } from "@/lib/collections-copy";
import { lastScanLabel, lastScanTitle } from "@/lib/collections-scan";
import type { CollectionFolder } from "@/types/collection";
import { useAppStore } from "@/store/app-store";
import { FolderControls } from "./FolderControls";
import { ScanState } from "./ScanState";

const COLUMNS: ReadonlyArray<Column<CollectionFolder>> = [
  { key: "name", label: "folder", cell: (folder) => folder.name },
  { key: "indexed", label: "indexed", align: "right", width: "72px", cell: (folder) => folder.indexedCount },
  { key: "scan", label: "scan", width: "112px", cell: (folder) => <ScanState scan={folder.scan} /> },
  {
    key: "last",
    label: "last scan",
    width: "136px",
    cell: (folder) => <span title={lastScanTitle(folder.lastScanAt)}>{lastScanLabel(folder.lastScanAt)}</span>,
  },
  { key: "controls", label: "", align: "right", width: "172px", cell: (folder) => <FolderControls folder={folder} /> },
];

/** The folders attached to one collection (`03` section 3.8). Their locations are never shown, only their names. Attach
 *  folder ends the group, under the table; section headers carry no buttons. With none, the table is drawn as skeleton
 *  rows. */
export function CollectionFolders({
  collectionId,
  folders,
}: {
  readonly collectionId: string;
  readonly folders: readonly CollectionFolder[];
}) {
  const verbs = useCollectionVerbs();
  const desktop = useAppStore((state) => state.runtime === "electron");
  return (
    <Group title="Folders" icon={Folder}>
      {folders.length === 0 ? (
        <SkeletonRows count={SKELETON_ROW_COUNT} />
      ) : (
        <DataTable label="Folders" columns={COLUMNS} rows={folders} rowKey={(folder) => folder.id} />
      )}
      <Actions>
        <Button
          variant="ghost"
          disabled={!desktop}
          title={
            desktop
              ? "Attach a folder this collection is built from. Files on disk are only read, never changed."
              : "This action is available in the desktop app."
          }
          onClick={() => void verbs.attach(collectionId)}
        >
          <FolderPlus aria-hidden /> Attach folder
        </Button>
      </Actions>
    </Group>
  );
}
