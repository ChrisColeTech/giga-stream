import { Library } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { Group } from "@/components/ui/Form";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { SKELETON_ROW_COUNT } from "@/lib/collections-copy";
import type { CollectionRow } from "@/types/collection";
import { ScanState } from "./ScanState";

/* The name is the row's one control: a button that selects the collection. A row takes no click of its own, since the
 * shared table does not carry one. */
function collectionColumns(onSelect: (id: string) => void): ReadonlyArray<Column<CollectionRow>> {
  return [
    {
      key: "name",
      label: "name",
      cell: (row) => (
        <button
          type="button"
          onClick={() => onSelect(row.id)}
          className={
            "w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left font-sans text-sm " +
            "text-text hover:underline underline-offset-2"
          }
        >
          {row.name}
        </button>
      ),
    },
    { key: "total", label: "items", align: "right", width: "84px", cell: (row) => row.total },
    { key: "manual", label: "manual", align: "right", width: "84px", cell: (row) => row.manual },
    { key: "folders", label: "folders", align: "right", width: "84px", cell: (row) => row.folders },
    { key: "scan", label: "scan", width: "112px", cell: (row) => <ScanState scan={row.scan} /> },
  ];
}

export interface CollectionsTableProps {
  readonly rows: readonly CollectionRow[];
  readonly onSelect: (id: string) => void;
}

/** Every collection with its totals, manual and folder counts and aggregate scan state. With none, the table is drawn as
 *  skeleton rows, not as an empty header (`06` section 2, rule 1). */
export function CollectionsTable({ rows, onSelect }: CollectionsTableProps) {
  return (
    <Group id="collections.list" title="Collections" icon={Library} last>
      {rows.length === 0 ? (
        <SkeletonRows count={SKELETON_ROW_COUNT} />
      ) : (
        <DataTable label="Collections" columns={collectionColumns(onSelect)} rows={rows} rowKey={(row) => row.id} />
      )}
    </Group>
  );
}
