import { Film, X } from "lucide-react";
import { DataTable } from "@giga/ui/lists/DataTable";
import type { Column } from "@giga/ui/lists/DataTable";
import { Group } from "@giga/ui/form/Group";
import { PosterImage } from "@/components/ui/PosterImage";
import { SkeletonRows } from "@giga/ui/lists/SkeletonRows";
import { SKELETON_ROW_COUNT } from "@/lib/collections-copy";
import type { MemberRow } from "@/lib/collections-members";
import { useCollectionVerbs } from "@/hooks/useCollectionVerbs";
import { CollectionIconAction } from "./CollectionIconAction";
import { FOLDER_MEMBERSHIP_REASON } from "@/lib/collection-menu";

function memberColumns(remove: (row: MemberRow) => void): ReadonlyArray<Column<MemberRow>> {
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
      cell: (row) => (
        <CollectionIconAction
          icon={X}
          label={`Remove ${row.title}`}
          reason={row.source === "folder" ? FOLDER_MEMBERSHIP_REASON : undefined}
          onPress={() => remove(row)}
        />
      ),
    },
  ];
}

/** The members of one collection: the titles and local files added by hand, each with its remove control. With none, the
 *  table is drawn as skeleton rows, not as an empty header (`06` section 2, rule 1). */
export function CollectionMembers({
  collectionId,
  rows,
  status,
  onRemoved,
}: {
  readonly collectionId: string;
  readonly rows: readonly MemberRow[];
  readonly status: "not-loaded" | "loaded";
  readonly onRemoved: () => void;
}) {
  const verbs = useCollectionVerbs();
  const remove = (row: MemberRow): void => {
    if (row.source !== "manual") return;
    void verbs.removeMember(collectionId, row.ref).then((removed) => { if (removed) onRemoved(); });
  };
  return (
    <Group title="Videos" icon={Film} last>
      {status === "not-loaded" ? (
        <SkeletonRows count={SKELETON_ROW_COUNT} />
      ) : rows.length === 0 ? (
        <SkeletonRows count={SKELETON_ROW_COUNT} />
      ) : (
        <DataTable label="Videos" columns={memberColumns(remove)} rows={rows} rowKey={(row) => row.key} />
      )}
    </Group>
  );
}
