import { Library } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { Group } from "@/components/ui/Group";
import type { CollectionRow } from "@/types/collection";

const COLUMNS: ReadonlyArray<Column<CollectionRow>> = [
  { key: "name", label: "name", cell: (row) => row.name },
  { key: "total", label: "items", align: "right", width: "84px", cell: (row) => row.total },
  { key: "manual", label: "manual", align: "right", width: "84px", cell: (row) => row.manual },
  { key: "folders", label: "folders", align: "right", width: "84px", cell: (row) => row.folders },
  { key: "scan", label: "scan", width: "110px", cell: (row) => row.scan },
];

/** Every collection with its totals, manual and folder counts and aggregate scan state. The table is the empty state when
 *  there are none: a header and nothing else. */
export function CollectionsTable({ rows }: { rows: readonly CollectionRow[] }) {
  return (
    <Group id="collections.list" title="Collections" icon={Library} tip="Every collection, with its totals and scan state." last>
      <DataTable label="Collections" columns={COLUMNS} rows={rows} rowKey={(row) => row.id} />
    </Group>
  );
}
