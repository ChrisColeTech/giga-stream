import { Film } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import { Group, Wide } from "@/components/ui/Form";
import { PosterImage } from "@/components/ui/PosterImage";
import { SkeletonRows } from "@/components/ui/SkeletonRows";
import { SKELETON_ROW_COUNT } from "@/lib/collections-copy";
import type { MemberRow } from "@/lib/collections-members";
import { MemberRemoveAction } from "./MemberRemoveAction";

function memberColumns(collectionId: string): ReadonlyArray<Column<MemberRow>> {
  return [
    {
      key: "poster",
      label: "",
      width: "36px",
      cell: (row) => (
        <div className="w-5">
          <PosterImage alt={row.title} src={row.poster} />
        </div>
      ),
    },
    { key: "title", label: "title or file", cell: (row) => row.title },
    { key: "year", label: "year", align: "right", width: "72px", cell: (row) => row.year },
    {
      key: "remove",
      label: "",
      align: "right",
      width: "56px",
      cell: (row) => <MemberRemoveAction collectionId={collectionId} memberRef={row.ref} title={row.title} />,
    },
  ];
}

/** The members of one collection: the titles and local files added by hand, each with its remove control. With none, the
 *  table is drawn as skeleton rows, not as an empty header (`06` section 2, rule 1). */
export function CollectionMembers({
  collectionId,
  rows,
  status,
}: {
  readonly collectionId: string;
  readonly rows: readonly MemberRow[];
  readonly status: "not-loaded" | "loaded";
}) {
  return (
    <Group title="Videos" icon={Film} last>
      {status === "not-loaded" ? (
        <Wide>
          <span className="block px-3 py-2 font-mono text-xs text-muted">Collection videos are not loaded yet.</span>
        </Wide>
      ) : rows.length === 0 ? (
        <SkeletonRows count={SKELETON_ROW_COUNT} />
      ) : (
        <DataTable label="Videos" columns={memberColumns(collectionId)} rows={rows} rowKey={(row) => row.key} />
      )}
    </Group>
  );
}
