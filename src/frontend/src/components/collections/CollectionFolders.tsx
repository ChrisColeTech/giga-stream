import { Folder, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { Group } from "@/components/ui/Group";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { Strip } from "@/components/ui/Strip";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { SKELETON_ROW_COUNT } from "@/lib/collections-copy";
import { lastScanLabel } from "@/lib/collections-scan";
import type { CollectionFolder } from "@/types/collection";
import { FolderControls } from "./FolderControls";
import { ScanState } from "./ScanState";

const COLUMNS: ReadonlyArray<Column<CollectionFolder>> = [
  { key: "name", label: "folder", cell: (folder) => folder.name },
  { key: "indexed", label: "indexed", align: "right", width: "72px", cell: (folder) => folder.indexedCount },
  { key: "scan", label: "scan", width: "112px", cell: (folder) => <ScanState scan={folder.scan} /> },
  { key: "last", label: "last scan", width: "136px", cell: (folder) => lastScanLabel(folder.lastScanAt) },
  { key: "controls", label: "", align: "right", width: "148px", cell: (folder) => <FolderControls folder={folder} /> },
];

/** The folders attached to one collection (`03` section 3.8). Their locations are never shown, only their names. With none,
 *  the table is drawn as skeleton rows, not as an empty header (`06` section 2, rule 1). */
export function CollectionFolders({
  collectionId,
  folders,
}: {
  readonly collectionId: string;
  readonly folders: readonly CollectionFolder[];
}) {
  const verbs = useCollectionVerbs();
  return (
    <Group
      id="collections.folders"
      title="Folders"
      icon={Folder}
      tip="The folders this collection is built from. Files on disk are only read, never changed."
    >
      {folders.length === 0 ? (
        <SkeletonRows count={SKELETON_ROW_COUNT} />
      ) : (
        <DataTable label="Folders" columns={COLUMNS} rows={folders} rowKey={(folder) => folder.id} />
      )}
      <Strip>
        <Button onClick={() => verbs.attach(collectionId)}>
          <FolderPlus className="size-3.5" />
          Attach folder
        </Button>
      </Strip>
    </Group>
  );
}
