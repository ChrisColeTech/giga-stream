import { Film, X } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { Group } from "@/components/ui/Group";
import { REMOVE_MEMBER_REASON } from "@/lib/collections-copy";
import type { MemberRow } from "@/lib/collections-members";
import { CollectionIconAction } from "./CollectionIconAction";

const COLUMNS: ReadonlyArray<Column<MemberRow>> = [
  { key: "title", label: "title or file", cell: (row) => row.title },
  { key: "year", label: "year", align: "right", width: "72px", cell: (row) => row.year },
  {
    key: "remove",
    label: "",
    align: "right",
    width: "44px",
    cell: (row) => <CollectionIconAction icon={X} label={`Remove ${row.title}`} reason={REMOVE_MEMBER_REASON} />,
  },
];

/** The members of one collection: the titles and local files added by hand, each with its remove control. */
export function CollectionMembers({ rows }: { readonly rows: readonly MemberRow[] }) {
  return (
    <Group
      id="collections.members"
      title="Members"
      icon={Film}
      tip="Titles and local files added by hand. Removing one never touches the original files."
    >
      <DataTable label="Members" columns={COLUMNS} rows={rows} rowKey={(row) => row.key} />
    </Group>
  );
}
